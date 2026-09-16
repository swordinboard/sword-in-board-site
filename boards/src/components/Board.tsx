import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { BoardItem, BoardState, StringView, WallTexture } from '../../shared/types';
import type { CSSProperties } from 'react';
import BoardItemView from './BoardItemView';
import Strings from './Strings';
import Hangers from './Hangers';
import { Moulding } from './ItemFace';
import { useToday } from '../lib/clock';
import { mediaUrl } from '../lib/api';

/** Gap allowed between the two taps of a double tap. */
const DOUBLE_TAP_MS = 400;
/** Diameter of the settings handle, matching board.css. */
const HANDLE_SIZE = 34;
/** How far a finger may wander and still count as a tap rather than a pan. */
const TAP_SLOP = 7;
/** Wood frame thickness from board.css, needed when fitting the board to view. */
const FRAME_PAD = 100;

/**
 * How much wall shows around the board once you have pulled right out, as a
 * share of the board on each side. A quarter is enough to see the board is
 * hung on something without it becoming a stamp in the middle of a wall.
 */
const ROOM_MARGIN = 0.25;

/**
 * As close as anyone can get, as a multiple of life size.
 *
 * Three is well past a real board, which is the point: on a big screen the
 * board should be able to fill it rather than stopping at the size the thing
 * would be in a hallway. Everything on it keeps its proportions either way -
 * the zoom is one number and it scales the lot.
 */
const CLOSEST = 3;

interface View {
  x: number;
  y: number;
  z: number;
}

export interface BoardHandle {
  /** Board coordinates at the centre of what the viewer is currently looking at. */
  centerPoint(): { x: number; y: number };
  zoomBy(factor: number): void;
  /** Zoom to an absolute level, holding the centre of the view still. */
  zoomTo(z: number): void;
  fit(): void;
  zoom(): number;
  /** The range a slider should span. */
  range(): { min: number; max: number };
}

interface Props {
  board: BoardState;
  editable: boolean;
  /** Draws a faint grid over the surface to line things up against. */
  grid?: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Asked for explicitly - a double tap, or the handle on the selected item. */
  onOpenSettings: (id: string) => void;
  /** The magnifier on the selected item: look at it properly. */
  onOpenItem: (id: string) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onCommit: () => void;
  onZoomChange?: (zoom: number) => void;
  /*
   * How far out and in this board can go, which is not a constant: it depends
   * on the board's size and the screen's, so the slider has to be told.
   */
  onRangeChange?: (range: { min: number; max: number }) => void;
  /** How much of the strings this reader wants to see. Theirs, not the board's. */
  stringView: StringView;
  /** An editor is tying strings: taps pick ends rather than selecting. */
  stringing?: boolean;
  onCutString?: (id: string) => void;
}

/**
 * Where a viewer may go: how far out, how far in, and how far off to the side.
 *
 * There used to be no answer to the last of those. Zoom was pinned between
 * two constants that knew nothing about the screen, and panning was unbounded,
 * so a board could be dragged away into wall until it was gone and the only
 * way back was Fit. Worse, with nowhere the wall stopped there was no size a
 * wall could be - which is why an uploaded one had to repeat.
 *
 * So there is a room, and everything falls out of it. The furthest out is the
 * zoom that puts the board and a margin of wall on screen together; the
 * closest is at least life size and at least enough to fill the screen; the
 * view is clamped so it never looks past the room's edges; and an uploaded
 * wall is one picture the size of everything the room can ever show.
 *
 * `edge` is how much wall may show past the board, in board pixels, and the
 * catch is that it cannot simply be a share of the board. A quarter of a
 * board is eleven hundred board pixels, which is a comfortable margin pulled
 * right out and half a phone screen at a middling zoom - so a board could be
 * shoved clean off the side and you would be looking at blank wall. The
 * margin is therefore whichever is smaller, that share or half a screen,
 * which comes to the same thing when pulled out and keeps half the screen on
 * the board when close in.
 *
 * `wall` is the widest the view can ever reach, which is what it reaches at
 * the floor: every zoom above it sees less, and the clamp keeps that inside.
 * Coordinates are the board's own, so the board is the box from 0,0 to its
 * outer width and height.
 */
interface Room {
  floor: number;
  ceiling: number;
  outerW: number;
  outerH: number;
  marginX: number;
  marginY: number;
  wall: { x0: number; y0: number; x1: number; y1: number };
}

function roomFor(board: BoardState, stageW: number, stageH: number): Room {
  const outerW = board.width + FRAME_PAD * 2;
  const outerH = board.height + FRAME_PAD * 2;
  const marginX = outerW * ROOM_MARGIN;
  const marginY = outerH * ROOM_MARGIN;
  // Far enough out that the board and its margin are on screen together.
  const floor = Math.min(
    stageW / (outerW + marginX * 2),
    stageH / (outerH + marginY * 2),
    CLOSEST,
  );
  const halfW = stageW / floor / 2;
  const halfH = stageH / floor / 2;
  return {
    floor,
    // Never less than life size, and never too far out to fill the screen.
    ceiling: Math.max(CLOSEST, floor, stageW / outerW, stageH / outerH),
    outerW,
    outerH,
    marginX,
    marginY,
    wall: {
      x0: outerW / 2 - halfW,
      y0: outerH / 2 - halfH,
      x1: outerW / 2 + halfW,
      y1: outerH / 2 + halfH,
    },
  };
}

/**
 * The nearest view to this one that stays in the room.
 *
 * Along each axis the view shows board coordinates from -pos/z to
 * (size - pos)/z, and both ends have to be inside the board plus its margin.
 * That pins `pos` between two bounds. They meet exactly when the screen holds
 * the whole of that span, which is what the floor zoom arranges, and open up
 * as you come closer. When the screen is wider than the span there is nowhere
 * to go, so it sits in the middle.
 */
function inRoom(v: View, room: Room, stageW: number, stageH: number): View {
  const z = Math.min(room.ceiling, Math.max(room.floor, v.z));
  const along = (pos: number, size: number, extent: number, margin: number) => {
    const edge = Math.min(margin, size / 2 / z);
    const lo = -edge;
    const hi = extent + edge;
    if (size / z >= hi - lo) return size / 2 - ((lo + hi) / 2) * z;
    return Math.min(-lo * z, Math.max(size - hi * z, pos));
  };
  return {
    z,
    x: along(v.x, stageW, room.outerW, room.marginX),
    y: along(v.y, stageH, room.outerH, room.marginY),
  };
}

/**
 * The door, measured in boards, because it has no size of its own.
 *
 * Most walls are made of something that does - a brick is seven inches
 * whatever it is behind - and the stylesheet says so. A door is drawn against
 * the board it is behind instead: `across` is how many boards wide one is,
 * and `above` is how far over the top of the board it starts, which puts the
 * head casing and the wall over it clear of the board rather than behind it.
 */
const BY_BOARD: Partial<Record<WallTexture, { across: number; above: number }>> = {
  door: { across: 1.5, above: 1.69 },
};

/**
 * A little past the room, so a rounded pixel never shows the end of a wall.
 *
 * Pulled right out the view is pinned to the room exactly, which puts the
 * edge of a covering picture on the edge of the screen - correct to the
 * pixel, and one rounding away from a hairline of bare colour down the side.
 */
const WALL_BLEED = 1.03;

/**
 * The proportions of an uploaded wall, once the browser knows them.
 *
 * A picture has to cover the room, and covering is a comparison between two
 * shapes - so the picture's shape has to be known, and nothing here knows it
 * until the file has loaded. It is one decode, off a file the wall is about
 * to ask for anyway, so it is in cache by the time it is drawn with.
 */
function useWallShape(id: string | undefined): number | null {
  const [shape, setShape] = useState<number | null>(null);
  useEffect(() => {
    setShape(null);
    if (!id) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live && img.naturalHeight) setShape(img.naturalWidth / img.naturalHeight);
    };
    img.src = mediaUrl(id);
    return () => {
      live = false;
    };
  }, [id]);
  return shape;
}

/**
 * The wall, as inline variables on the stage.
 *
 * Two jobs. The first is which wall: an uploaded picture wins over a named
 * paper, which wins over the colour alone, and the picture has to be set here
 * rather than in the stylesheet because its address is a media id nobody can
 * write a rule for.
 *
 * The second is where the wall is, which is the board's business rather than
 * the screen's. Handing the view down as variables puts the paper on the
 * board's own corner and sizes it by the board's zoom, so a wall behaves like
 * a wall: it slides under the board when the board is dragged and the bricks
 * get bigger when it is pinched, instead of sitting still like a backdrop
 * painted on the window.
 *
 * An uploaded wall is one picture over the whole room. That is only possible
 * because the room has edges - before there were any, a covering picture had
 * no size it could be, since pinching out far enough would always find the
 * end of it. Now the far end of the zoom is the room, so a picture the size
 * of the room is a wall nobody can see past. It is covered rather than
 * stretched, so a picture keeps its own shape and is cropped instead.
 *
 * The door still repeats. It is drawn well past the room in both directions,
 * so the repeat is out of reach either way, and repeating means it does not
 * have to be measured.
 */
function wallStyle(
  board: BoardState,
  view: View,
  room: Room,
  wallShape: number | null,
): CSSProperties {
  const style: Record<string, string> = {
    '--wall-zoom': String(view.z),
    '--wall-x': `${view.x}px`,
    '--wall-y': `${view.y}px`,
  };
  if (board.wall) style['--wall-color'] = board.wall;

  const outerW = board.width + FRAME_PAD * 2;
  const outerH = board.height + FRAME_PAD * 2;

  if (board.wallImage) {
    /*
     * Held back until the shape is known rather than guessed at. A wall drawn
     * at the wrong shape and corrected a moment later is a visible flinch;
     * the board's own colour for that moment is not.
     */
    if (wallShape) {
      const roomW = (room.wall.x1 - room.wall.x0) * WALL_BLEED;
      const roomH = (room.wall.y1 - room.wall.y0) * WALL_BLEED;
      const wide = Math.max(roomW, roomH * wallShape);
      const tall = wide / wallShape;
      style['--wall-tex'] = `url("${mediaUrl(board.wallImage)}")`;
      style['--wall-tex-size'] = `${wide * view.z}px ${tall * view.z}px`;
      style['--wall-tex-repeat'] = 'no-repeat';
      style['--wall-tex-at'] =
        `${view.x + (outerW / 2 - wide / 2) * view.z}px ${view.y + (outerH / 2 - tall / 2) * view.z}px`;
    }
    return style as CSSProperties;
  }

  const hung = board.wallTex && BY_BOARD[board.wallTex];
  if (hung) {
    const across = outerW * hung.across;
    /*
     * Only the width is set. `auto` for the height keeps the door in its own
     * proportions, which is what stops it being stretched to this length.
     */
    style['--wall-tex-size'] = `${across * view.z}px auto`;
    style['--wall-tex-at'] =
      `${view.x + ((outerW - across) / 2) * view.z}px ${view.y - outerH * hung.above * view.z}px`;
  }
  return style as CSSProperties;
}

const Board = forwardRef<BoardHandle, Props>(function Board(
  {
    board,
    editable,
    grid,
    selectedId,
    onSelect,
    onOpenSettings,
    onOpenItem,
    onMoveItem,
    onCommit,
    onZoomChange,
    onRangeChange,
    stringView,
    stringing,
    onCutString,
  },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 0.5 });
  const wallShape = useWallShape(board.wallImage);
  /*
   * The room depends on the screen as well as the board, so it is measured
   * rather than worked out once - a phone turned on its side is a different
   * room, with a different furthest-out and different edges to stop at.
   */
  const [room, setRoom] = useState<Room>(() => roomFor(board, 1024, 768));
  const [panning, setPanning] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // One clock for the whole board, so every whiteboard on it agrees.
  const today = useToday(board.timeZone);

  // Interaction bookkeeping lives in refs so pointer moves never re-render
  // anything they do not have to.
  const viewRef = useRef(view);
  viewRef.current = view;
  const roomRef = useRef(room);
  roomRef.current = room;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{ x: number; y: number; view: View } | null>(null);
  const pinchStart = useRef<{ distance: number; z: number; mid: { x: number; y: number } } | null>(
    null,
  );
  const dragStart = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  /** Last tap on an item, for spotting the second half of a double tap. */
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  /**
   * A press on an item while only looking, which becomes a selection if the
   * pointer stays put. It cannot select on the press itself: most of a full
   * board is items, and swallowing the press there would leave hardly
   * anywhere to drag from to pan.
   */
  const tapStart = useRef<{ id: string; x: number; y: number } | null>(null);

  /** A view, put back inside the room before it reaches the screen. */
  const settle = useCallback((next: View | ((v: View) => View)) => {
    const stage = stageRef.current;
    if (!stage) return;
    setView((v) => inRoom(
      typeof next === 'function' ? next(v) : next,
      roomRef.current,
      stage.clientWidth,
      stage.clientHeight,
    ));
  }, []);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const outerW = board.width + FRAME_PAD * 2;
    const outerH = board.height + FRAME_PAD * 2;
    const margin = 48;
    const z = Math.min((stage.clientWidth - margin) / outerW, (stage.clientHeight - margin) / outerH);
    settle({
      x: (stage.clientWidth - outerW * z) / 2,
      y: (stage.clientHeight - outerH * z) / 2,
      z,
    });
  }, [board.width, board.height, settle]);

  /*
   * Measure the room whenever the board or the screen changes shape, and put
   * the view back inside the new one. Turning a phone on its side moves the
   * edges; without this the view would be left outside them until the next
   * drag noticed.
   */
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const next = roomFor(board, stage.clientWidth, stage.clientHeight);
      roomRef.current = next;
      setRoom(next);
      setView((v) => inRoom(v, next, stage.clientWidth, stage.clientHeight));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(stage);
    return () => watch.disconnect();
  }, [board.width, board.height]);

  useLayoutEffect(() => {
    fit();
    // Fit once for a given board size; later changes are the viewer's to make.
  }, [fit]);

  useEffect(() => {
    onZoomChange?.(view.z);
  }, [view.z, onZoomChange]);

  useEffect(() => {
    onRangeChange?.({ min: room.floor, max: room.ceiling });
  }, [room.floor, room.ceiling, onRangeChange]);

  /** Screen point -> board coordinates. */
  const toBoard = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const v = viewRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    return {
      x: (clientX - rect.left - v.x) / v.z - FRAME_PAD,
      y: (clientY - rect.top - v.y) / v.z - FRAME_PAD,
    };
  }, []);

  const zoomAt = useCallback((factor: number, clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    settle((v) => {
      const z = Math.min(roomRef.current.ceiling, Math.max(roomRef.current.floor, v.z * factor));
      const ratio = z / v.z;
      return { z, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, [settle]);

  useImperativeHandle(
    ref,
    () => ({
      centerPoint() {
        const stage = stageRef.current;
        if (!stage) return { x: board.width / 2, y: board.height / 2 };
        const rect = stage.getBoundingClientRect();
        return toBoard(rect.left + rect.width / 2, rect.top + rect.height / 2);
      },
      zoomBy(factor: number) {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
      },
      zoomTo(z: number) {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        zoomAt(z / viewRef.current.z, rect.left + rect.width / 2, rect.top + rect.height / 2);
      },
      fit,
      zoom: () => viewRef.current.z,
      range: () => ({ min: roomRef.current.floor, max: roomRef.current.ceiling }),
    }),
    [board.width, board.height, toBoard, zoomAt, fit],
  );

  // Wheel must be non-passive to stop the page from scrolling behind the board.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) > 0) {
        const factor = Math.exp(-event.deltaY * 0.0015);
        zoomAt(factor, event.clientX, event.clientY);
      }
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const midpoint = () => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onStagePointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (pointers.current.size === 2) {
      panStart.current = null;
      pinchStart.current = { distance: spread(), z: viewRef.current.z, mid: midpoint() };
      return;
    }
    if (pointers.current.size !== 1 || dragStart.current) return;
    // A press on the cork itself pans and clears the selection.
    onSelect(null);
    setPanning(true);
    panStart.current = { x: event.clientX, y: event.clientY, view: viewRef.current };
  };

  const onStagePointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinchStart.current && pointers.current.size === 2) {
      const start = pinchStart.current;
      const factor = spread() / (start.distance || 1);
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const z = Math.min(roomRef.current.ceiling, Math.max(roomRef.current.floor, start.z * factor));
      settle((v) => {
        const ratio = z / v.z;
        const px = start.mid.x - rect.left;
        const py = start.mid.y - rect.top;
        return { z, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
      });
      return;
    }

    if (dragStart.current) {
      const point = toBoard(event.clientX, event.clientY);
      const x = Math.round(point.x - dragStart.current.dx);
      const y = Math.round(point.y - dragStart.current.dy);
      const item = board.items.find((candidate) => candidate.id === dragStart.current!.id);
      if (item && (item.x !== x || item.y !== y)) dragStart.current.moved = true;
      onMoveItem(dragStart.current.id, x, y);
      return;
    }

    const start = panStart.current;
    if (!start) return;
    settle({
      x: start.view.x + (event.clientX - start.x),
      y: start.view.y + (event.clientY - start.y),
      z: start.view.z,
    });
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      panStart.current = null;
      setPanning(false);

      const tap = tapStart.current;
      tapStart.current = null;
      if (tap && !dragStart.current) {
        const travelled = Math.hypot(event.clientX - tap.x, event.clientY - tap.y);
        // The press on the cork cleared the selection on the way down; a tap
        // that went nowhere puts this item's back.
        if (travelled <= TAP_SLOP) onSelect(tap.id);
      }

      if (dragStart.current) {
        const { id, moved } = dragStart.current;
        dragStart.current = null;
        setDraggingId(null);
        // Only a tap that stayed put counts towards a double tap; a drag that
        // happens to end where it started is still a drag.
        if (!moved) {
          const previous = lastTap.current;
          const now = Date.now();
          if (previous && previous.id === id && now - previous.at < DOUBLE_TAP_MS) {
            lastTap.current = null;
            onOpenSettings(id);
          } else {
            lastTap.current = { id, at: now };
          }
        } else {
          lastTap.current = null;
        }
        onCommit();
      }
    }
  };

  const onItemPointerDown = (event: React.PointerEvent, item: BoardItem) => {
    /*
     * While stringing, a tap picks an end rather than selecting or dragging.
     * Tying a string and moving an item are different jobs and a press cannot
     * be both, so the mode decides which this one is.
     */
    if (stringing && editable) {
      event.stopPropagation();
      onSelect(item.id);
      return;
    }
    if (!editable) {
      // Noted, not acted on: the press still reaches the stage so a drag from
      // here pans the board, and only a press that stays put selects.
      tapStart.current = { id: item.id, x: event.clientX, y: event.clientY };
      return;
    }
    event.stopPropagation();
    onSelect(item.id);
    const point = toBoard(event.clientX, event.clientY);
    dragStart.current = { id: item.id, dx: point.x - item.x, dy: point.y - item.y, moved: false };
    setDraggingId(item.id);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stageRef.current?.setPointerCapture(event.pointerId);
  };

  // Arrow keys nudge the selection; the mouse cannot place to the pixel.
  useEffect(() => {
    if (!editable || !selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = event.shiftKey ? 10 : 1;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();
      const item = board.items.find((candidate) => candidate.id === selectedId);
      if (!item) return;
      onMoveItem(item.id, item.x + delta[0], item.y + delta[1]);
      onCommit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, selectedId, board.items, onMoveItem, onCommit]);

  const ordered = [...board.items].sort((a, b) => a.z - b.z);

  /**
   * The selected item's box in screen coordinates, used for both the ring
   * around it and the position of its settings handle.
   *
   * Both are drawn out here rather than inside the board, because inside it
   * they scale with the zoom: at 8% the ring is a hairline and a handle big
   * enough to tap covers the item it belongs to.
   */
  // Selecting works the same whether editing or only looking; what the handle
  // beside the selection offers is what differs.
  const selectedItem = board.items.find((i) => i.id === selectedId);
  const marks = (() => {
    const stage = stageRef.current;
    if (!selectedItem || !stage) return null;
    const left = view.x + (FRAME_PAD + selectedItem.x) * view.z;
    const top = view.y + (FRAME_PAD + selectedItem.y) * view.z;
    const width = selectedItem.w * view.z;
    const height = selectedItem.h * view.z;

    const gap = HANDLE_SIZE / 2 + 3;
    const edge = HANDLE_SIZE / 2 + 4;
    // Wholly outside the top-right corner, flipping to whichever side has room
    // rather than being pushed back over the item it belongs to.
    let hx = left + width + gap;
    let hy = top - gap;
    if (hx > stage.clientWidth - edge) hx = left - gap;
    if (hy < edge) hy = top + height + gap;

    return {
      id: selectedItem.id,
      ring: { left, top, width, height, rotation: selectedItem.rotation },
      handle: {
        x: Math.min(Math.max(hx, edge), stage.clientWidth - edge),
        y: Math.min(Math.max(hy, edge), stage.clientHeight - edge),
      },
    };
  })();
  const handle = marks && !draggingId ? { id: marks.id, ...marks.handle } : null;

  return (
    <div
      ref={stageRef}
      className={`stage${panning ? ' panning' : ''}`}
      data-board-style={board.style ?? 'cork'}
      /* A named paper is a stylesheet's business; an uploaded one is not, so
         only the first reaches the attribute. */
      data-wall={board.wallImage ? undefined : board.wallTex}
      style={wallStyle(board, view, room, wallShape)}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        className="board-wrap"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})` }}
      >
        {/*
          The board's name, sitting above the frame. It counter-scales against
          the zoom so it reads at the same size whatever the board is doing -
          zoomed right out, the board is a postage stamp and a title that
          scaled with it would be nothing at all.
        */}
        <div
          className="board-name"
          data-font={board.titleFont ?? 'plain'}
          style={{ transform: `translateX(-50%) scale(${1 / view.z})` }}
        >
          {board.title}
        </div>
        <div className="board">
          <Moulding />
          <div
            className={`cork${grid ? ' gridded' : ''}`}
            style={{ width: board.width, height: board.height }}
          >
            {ordered.length === 0 ? (
              <div className="cork-empty">
                Nothing on the board yet
                <small>
                  {editable
                    ? 'Open the menu and pin something up.'
                    : 'Check back once something is posted.'}
                </small>
              </div>
            ) : null}
            {ordered.map((item) => (
              <BoardItemView
                key={item.id}
                item={item}
                editable={editable}
                selected={selectedId === item.id}
                dragging={draggingId === item.id}
                today={today}
                onPointerDown={onItemPointerDown}
              />
            ))}
            <Strings
              strings={board.strings ?? []}
              items={board.items}
              view={stringView}
              onCut={stringing ? onCutString : undefined}
            />
            <Hangers items={ordered} />
          </div>
        </div>
      </div>

      {marks ? (
        <div
          className="item-ring"
          style={{
            left: marks.ring.left,
            top: marks.ring.top,
            width: marks.ring.width,
            height: marks.ring.height,
            transform: `rotate(${marks.ring.rotation}deg)`,
          }}
          aria-hidden
        />
      ) : null}

      {/*
        The way in to the selected item's settings.
        It lives out here, in screen coordinates, rather than inside the board.
        Drawn inside the zoomed layer it had to counter-scale to stay tappable,
        and at 8% zoom that made a 34px button cover 400px of board - swallowing
        the very item it belonged to, so tapping the item opened its settings.
        Out here it is simply always 34px, just outside the item's corner.
      */}
      {handle ? (
        <button
          type="button"
          className="item-settings"
          style={{ left: handle.x, top: handle.y }}
          aria-label={editable ? 'Settings for this item' : 'Look at this properly'}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (editable) onOpenSettings(handle.id);
            else onOpenItem(handle.id);
          }}
        >
          {editable ? (
            <span aria-hidden>&hellip;</span>
          ) : (
            /* A magnifier, so that opening something is always deliberate
               rather than the price of touching it. */
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden focusable="false">
              <circle cx="8.5" cy="8.5" r="5.4" fill="none" stroke="currentColor" strokeWidth="2" />
              <line
                x1="12.6"
                y1="12.6"
                x2="17"
                y2="17"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      ) : null}
    </div>
  );
});

export default Board;
