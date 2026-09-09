import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { BoardItem, BoardState } from '../../shared/types';
import BoardItemView from './BoardItemView';

const MIN_ZOOM = 0.08;
const MAX_ZOOM = 3;
/** Wood frame thickness from board.css, needed when fitting the board to view. */
const FRAME_PAD = 30;

interface View {
  x: number;
  y: number;
  z: number;
}

export interface BoardHandle {
  /** Board coordinates at the centre of what the viewer is currently looking at. */
  centerPoint(): { x: number; y: number };
  zoomBy(factor: number): void;
  fit(): void;
  zoom(): number;
}

interface Props {
  board: BoardState;
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onCommit: () => void;
  onZoomChange?: (zoom: number) => void;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

const Board = forwardRef<BoardHandle, Props>(function Board(
  { board, editable, selectedId, onSelect, onMoveItem, onCommit, onZoomChange },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 0.5 });
  const [panning, setPanning] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Interaction bookkeeping lives in refs so pointer moves never re-render
  // anything they do not have to.
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panStart = useRef<{ x: number; y: number; view: View } | null>(null);
  const pinchStart = useRef<{ distance: number; z: number; mid: { x: number; y: number } } | null>(
    null,
  );
  const dragStart = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const outerW = board.width + FRAME_PAD * 2;
    const outerH = board.height + FRAME_PAD * 2;
    const margin = 48;
    const z = clampZoom(
      Math.min((stage.clientWidth - margin) / outerW, (stage.clientHeight - margin) / outerH),
    );
    setView({
      x: (stage.clientWidth - outerW * z) / 2,
      y: (stage.clientHeight - outerH * z) / 2,
      z,
    });
  }, [board.width, board.height]);

  useLayoutEffect(() => {
    fit();
    // Fit once for a given board size; later changes are the viewer's to make.
  }, [fit]);

  useEffect(() => {
    onZoomChange?.(view.z);
  }, [view.z, onZoomChange]);

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
    setView((v) => {
      const z = clampZoom(v.z * factor);
      const ratio = z / v.z;
      return { z, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
    });
  }, []);

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
      fit,
      zoom: () => viewRef.current.z,
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
      const z = clampZoom(start.z * factor);
      setView((v) => {
        const ratio = z / v.z;
        const px = start.mid.x - rect.left;
        const py = start.mid.y - rect.top;
        return { z, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
      });
      return;
    }

    if (dragStart.current) {
      const point = toBoard(event.clientX, event.clientY);
      onMoveItem(
        dragStart.current.id,
        Math.round(point.x - dragStart.current.dx),
        Math.round(point.y - dragStart.current.dy),
      );
      return;
    }

    const start = panStart.current;
    if (!start) return;
    setView({
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
      if (dragStart.current) {
        dragStart.current = null;
        setDraggingId(null);
        onCommit();
      }
    }
  };

  const onItemPointerDown = (event: React.PointerEvent, item: BoardItem) => {
    if (!editable) return;
    event.stopPropagation();
    onSelect(item.id);
    const point = toBoard(event.clientX, event.clientY);
    dragStart.current = { id: item.id, dx: point.x - item.x, dy: point.y - item.y };
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

  return (
    <div
      ref={stageRef}
      className={`stage${panning ? ' panning' : ''}`}
      onPointerDown={onStagePointerDown}
      onPointerMove={onStagePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      <div
        className={`board-wrap${panning || draggingId ? ' moving' : ''}`}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})` }}
      >
        <div className="board">
          <div className="cork" style={{ width: board.width, height: board.height }}>
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
                onPointerDown={onItemPointerDown}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default Board;
