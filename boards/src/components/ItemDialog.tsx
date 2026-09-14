import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BoardItem } from '../../shared/types';
import { Contents, Fastener } from './ItemFace';
import { plainText } from '../lib/markup';

interface Props {
  item: BoardItem;
  /** Today in the board's zone, so a whiteboard reads the same as on the wall. */
  today: string;
  onClose: () => void;
}

interface View {
  x: number;
  y: number;
  z: number;
}

/** How far past fitting the screen an item can be pushed. */
const MAX_OVER_FIT = 8;
/** Nothing is worth drawing at more than this, however small it started. */
const MAX_ZOOM = 6;

/**
 * One item, opened to be looked at.
 *
 * Shown at the shape it was given when it went up and no other: an item that
 * changed shape on being opened would be a different item, and what shape it
 * is was a decision somebody made. So nothing here re-lays it out. It starts
 * at whatever size fits the screen and can be pushed around and zoomed into
 * from there, the way a page of a document is read rather than the way a
 * picture is fitted to a frame.
 */
export default function ItemDialog({ item, today, onClose }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [dragging, setDragging] = useState(false);

  const viewRef = useRef<View | null>(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panFrom = useRef<{ x: number; y: number; view: View } | null>(null);
  const pinchFrom = useRef<{ gap: number; z: number; mid: { x: number; y: number } } | null>(null);

  /** The size at which the whole of it is on screen, with a little air. */
  const fitZoom = useCallback(() => {
    const box = stage.current;
    if (!box) return 1;
    const margin = 28;
    return Math.min(
      MAX_ZOOM,
      Math.min((box.clientWidth - margin) / item.w, (box.clientHeight - margin) / item.h),
    );
  }, [item.w, item.h]);

  const fit = useCallback(() => {
    const box = stage.current;
    if (!box) return;
    const z = fitZoom();
    setView({
      x: (box.clientWidth - item.w * z) / 2,
      y: (box.clientHeight - item.h * z) / 2,
      z,
    });
  }, [fitZoom, item.w, item.h]);

  useLayoutEffect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  /**
   * Keeps the item somewhere it can be reached. Smaller than the screen it
   * sits in the middle; larger, its edges may not be dragged inside it, so
   * there is never a blank screen with the thing you were reading off it.
   */
  const settle = useCallback(
    (next: View): View => {
      const box = stage.current;
      if (!box) return next;
      const hold = (offset: number, drawn: number, room: number) =>
        drawn <= room ? (room - drawn) / 2 : Math.min(0, Math.max(room - drawn, offset));
      return {
        z: next.z,
        x: hold(next.x, item.w * next.z, box.clientWidth),
        y: hold(next.y, item.h * next.z, box.clientHeight),
      };
    },
    [item.w, item.h],
  );

  /** Zooms about a point on the screen, so what is under it stays under it. */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const box = stage.current;
      const now = viewRef.current;
      if (!box || !now) return;
      const rect = box.getBoundingClientRect();
      const floor = fitZoom();
      const z = Math.min(Math.max(now.z * factor, floor), Math.min(MAX_ZOOM, floor * MAX_OVER_FIT));
      if (z === now.z) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const k = z / now.z;
      setView(settle({ x: px - (px - now.x) * k, y: py - (py - now.y) * k, z }));
    },
    [fitZoom, settle],
  );

  useEffect(() => {
    const box = stage.current;
    if (!box) return;
    // Non-passive, or the page behind scrolls instead.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const midpoint = () => {
    const [a, b] = [...pointers.current.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    /*
     * A press that starts on a link belongs to the link. Out on the board a
     * press is for the board and a link cannot have it, but in here the item
     * is already open and there is nothing else the press could have meant -
     * so the link keeps it, and the pan gives up the few characters it covers.
     */
    if ((event.target as HTMLElement).closest('a[data-link]')) return;
    // Or the browser starts a text selection or an image drag of its own.
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      panFrom.current = null;
      pinchFrom.current = { gap: spread(), z: viewRef.current?.z ?? 1, mid: midpoint() };
      return;
    }
    if (pointers.current.size !== 1 || !viewRef.current) return;
    panFrom.current = { x: event.clientX, y: event.clientY, view: viewRef.current };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pinch = pinchFrom.current;
    if (pinch && pointers.current.size === 2) {
      const now = viewRef.current;
      if (!now || pinch.gap === 0) return;
      zoomAt((pinch.z * (spread() / pinch.gap)) / now.z, pinch.mid.x, pinch.mid.y);
      return;
    }

    const from = panFrom.current;
    if (!from) return;
    setView(
      settle({
        x: from.view.x + (event.clientX - from.x),
        y: from.view.y + (event.clientY - from.y),
        z: from.view.z,
      }),
    );
  };

  const endPointer = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchFrom.current = null;
    if (pointers.current.size === 0) {
      panFrom.current = null;
      setDragging(false);
    }
  };

  /** Zooms about the middle of the view, which is not the middle of the page. */
  const zoomMiddle = (factor: number) => {
    const box = stage.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  // The title bar is one line at one weight, so the body goes up there with
  // its marks taken out rather than with its asterisks showing.
  const name = item.heading || plainText(item.body ?? '').slice(0, 120) || 'On the board';
  const atFit = view ? Math.abs(view.z - fitZoom()) < 0.001 : true;

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label={name}>
      <header>
        <h2>{name}</h2>
        <button
          type="button"
          onClick={() => (atFit ? zoomMiddle(2) : fit())}
          aria-label={atFit ? 'Zoom in' : 'Fit on screen'}
        >
          {atFit ? '+' : '❑'}
        </button>
        <button type="button" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div
        className={`item-view${dragging ? ' moving' : ''}`}
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div
          className={`item frame-${item.frame}${item.aspect ? ' shaped' : ''}`}
          style={{
            width: item.w,
            height: item.h,
            visibility: view ? undefined : 'hidden',
            transform: view ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})` : undefined,
            ...(item.aspect ? { ['--aspect' as string]: String(item.aspect) } : null),
            ...(item.typeSize ? { ['--type' as string]: `${item.typeSize * (117 / 72)}px` } : null),
          }}
        >
          <Fastener item={item} />
          <div className="surface">
            <Contents item={item} today={today} links />
          </div>
        </div>
      </div>
    </div>
  );
}
