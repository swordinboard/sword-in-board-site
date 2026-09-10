import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CropRect } from '../lib/image';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

interface Props {
  image: HTMLImageElement;
  /** Locked width-to-height ratio, or null to crop freely. */
  ratio: number | null;
  onChange: (rect: CropRect) => void;
  maxHeight?: number;
}

const MIN_SIZE = 24;

/** Largest rect of the given ratio that fits inside the image, centred. */
function initialRect(natW: number, natH: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w: natW, h: natH };
  let w = natW;
  let h = w / ratio;
  if (h > natH) {
    h = natH;
    w = h * ratio;
  }
  return { x: (natW - w) / 2, y: (natH - h) / 2, w, h };
}

export default function Cropper({ image, ratio, onChange, maxHeight = 400 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [rect, setRect] = useState<CropRect>(() =>
    initialRect(image.naturalWidth, image.naturalHeight, ratio),
  );
  const drag = useRef<{ handle: Handle; startX: number; startY: number; rect: CropRect } | null>(
    null,
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      setHostWidth(host.clientWidth);
      setViewportH(window.innerHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // A new image or a new ratio resets the selection.
  useEffect(() => {
    const next = initialRect(image.naturalWidth, image.naturalHeight, ratio);
    setRect(next);
    onChange(next);
  }, [image, ratio, onChange]);

  // On a phone a 400px crop is most of the screen, and everything below it -
  // the frames, the preview, the button - ends up behind a scroll nobody
  // realises is there. Give it a share of the viewport instead.
  const roomForCrop = viewportH ? Math.min(maxHeight, viewportH * 0.42) : maxHeight;
  const scale = hostWidth
    ? Math.min(hostWidth / image.naturalWidth, roomForCrop / image.naturalHeight)
    : 0;
  const displayW = image.naturalWidth * scale;
  const displayH = image.naturalHeight * scale;

  const clampRect = useCallback(
    (candidate: CropRect): CropRect => {
      const natW = image.naturalWidth;
      const natH = image.naturalHeight;
      let { x, y, w, h } = candidate;
      w = Math.max(MIN_SIZE, Math.min(w, natW));
      h = Math.max(MIN_SIZE, Math.min(h, natH));
      x = Math.max(0, Math.min(x, natW - w));
      y = Math.max(0, Math.min(y, natH - h));
      return { x, y, w, h };
    },
    [image.naturalWidth, image.naturalHeight],
  );

  const onPointerDown = (event: React.PointerEvent, handle: Handle) => {
    event.preventDefault();
    event.stopPropagation();
    // Capture on the canvas, which is where the move and up handlers live, so a
    // fast drag that leaves the handle still tracks.
    canvasRef.current?.setPointerCapture(event.pointerId);
    drag.current = { handle, startX: event.clientX, startY: event.clientY, rect };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state || !scale) return;
    const dx = (event.clientX - state.startX) / scale;
    const dy = (event.clientY - state.startY) / scale;
    const base = state.rect;

    if (state.handle === 'move') {
      setRect(clampRect({ ...base, x: base.x + dx, y: base.y + dy }));
      return;
    }

    const right = base.x + base.w;
    const bottom = base.y + base.h;
    let next: CropRect;
    switch (state.handle) {
      case 'nw':
        next = { x: base.x + dx, y: base.y + dy, w: base.w - dx, h: base.h - dy };
        break;
      case 'ne':
        next = { x: base.x, y: base.y + dy, w: base.w + dx, h: base.h - dy };
        break;
      case 'sw':
        next = { x: base.x + dx, y: base.y, w: base.w - dx, h: base.h + dy };
        break;
      case 'se':
      default:
        next = { x: base.x, y: base.y, w: base.w + dx, h: base.h + dy };
        break;
    }

    if (ratio) {
      // Height follows width, then the anchored edges are restored.
      next.h = next.w / ratio;
      if (state.handle === 'nw' || state.handle === 'ne') next.y = bottom - next.h;
      if (state.handle === 'nw' || state.handle === 'sw') next.x = right - next.w;
    }
    const clamped = clampRect(next);
    setRect(clamped);
    onChange(clamped);
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    onChange(rect);
  };

  return (
    <div className="cropper" ref={hostRef}>
      <div
        className="cropper-canvas"
        ref={canvasRef}
        style={{ width: displayW || undefined, height: displayH || undefined }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img src={image.src} alt="" draggable={false} />
        <div className="cropper-shade" />
        {scale > 0 ? (
          <div
            className="cropper-window"
            style={{
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.w * scale,
              height: rect.h * scale,
            }}
            onPointerDown={(event) => onPointerDown(event, 'move')}
          >
            {/* Clipping lives on an inner layer so the handles are not cut off. */}
            <div className="cropper-window-clip">
              <img
                src={image.src}
                alt=""
                draggable={false}
                style={{
                  width: displayW,
                  height: displayH,
                  marginLeft: -rect.x * scale,
                  marginTop: -rect.y * scale,
                  maxWidth: 'none',
                }}
              />
              <span className="grid" aria-hidden />
            </div>
            {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
              <span
                key={handle}
                className={`handle ${handle}`}
                onPointerDown={(event) => onPointerDown(event, handle)}
              />
            ))}
          </div>
        ) : null}
      </div>
      <p className="cropper-readout">
        {Math.round(rect.w)} &times; {Math.round(rect.h)} px
      </p>
    </div>
  );
}
