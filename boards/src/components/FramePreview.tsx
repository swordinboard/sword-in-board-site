import type { BoardLine, FrameStyle, HangerStyle } from '../../shared/types';
import type { CropRect } from '../lib/image';
import { sizeFor } from '../lib/frames';
import { forwardRef } from 'react';
import { Contents, Fastener } from './ItemFace';

interface Props {
  image: HTMLImageElement | null;
  rect: CropRect | null;
  frame: FrameStyle;
  hanger: HangerStyle;
  pinColor?: string;
  body?: string;
  /** The line across the top of a written item. */
  heading?: string;
  /** Written on the white below an instant photo. */
  caption?: string;
  /** Chosen size for the writing, in points. */
  typeSize?: number;
  /** For a whiteboard: the lines it keeps, drawn as they will read. */
  lines?: BoardLine[];
  /** Today in the board's zone, so the preview shows the real day. */
  today?: string;
  /** For a folder or magazine: how many pictures, and the one on show. */
  galleryCount?: number;
  galleryCover?: string;
  /** Longest edge the preview may occupy on screen. */
  max?: number;
}

/**
 * The item as it will actually hang, drawn with the board's own markup and
 * scaled down to fit.
 *
 * The crop is shown by offsetting the source image inside a clipped box rather
 * than by re-encoding it. Producing a real cropped file on every handle drag
 * would be far too slow, and the result on screen is identical.
 */
const FramePreview = forwardRef<HTMLDivElement, Props>(function FramePreview({
  image,
  rect,
  frame,
  hanger,
  pinColor,
  body,
  heading,
  caption,
  typeSize,
  lines,
  today,
  galleryCount,
  galleryCover,
  max = 190,
}, ref) {
  const aspect = rect && rect.h > 0 ? rect.w / rect.h : 1;
  const size = sizeFor(frame, aspect);
  const scale = Math.min(1, max / Math.max(size.w, size.h));
  const item = {
    frame,
    hanger,
    pinColor,
    body: body?.trim() || undefined,
    // Always set for a whiteboard, so the face treats the two apart rather
    // than falling back to reading the body as a heading.
    heading: frame === 'whiteboard' ? (heading?.trim() ?? '') : heading?.trim() || undefined,
    caption: caption?.trim() || undefined,
    lines,
    // Stand-in ids purely so the face draws the right count; the cover itself
    // comes through `media` as an object URL, since nothing is uploaded yet.
    mediaIds: galleryCount === undefined ? undefined : Array.from({ length: galleryCount }, (_, i) => String(i)),
  };

  const media = galleryCover ? (
    <div className="crop-view">
      <img src={galleryCover} alt="" draggable={false} style={{ width: '100%', height: '100%', left: 0, top: 0, objectFit: 'cover' }} />
    </div>
  ) : image && rect ? (
      <div className="crop-view">
        <img
          src={image.src}
          alt=""
          draggable={false}
          style={{
            width: `${(image.naturalWidth / rect.w) * 100}%`,
            height: `${(image.naturalHeight / rect.h) * 100}%`,
            left: `${(-rect.x / rect.w) * 100}%`,
            top: `${(-rect.y / rect.h) * 100}%`,
          }}
        />
      </div>
    ) : undefined;

  return (
    // Headroom for the fastener, which hangs above the item's own box.
    <div className="preview-well" style={{ height: size.h * scale + 52 }}>
      {/*
        The stage takes the SCALED size while the item inside keeps its true
        size and is scaled from its top-left corner. Scaling the item without
        shrinking its layout box left a tall photo occupying far more room than
        it drew, and the centring then pushed the whole thing off the bottom.
      */}
      <div className="preview-stage" style={{ width: size.w * scale, height: size.h * scale }}>
        <div
          ref={ref}
          className={`item frame-${frame}${rect ? ' shaped' : ''}`}
          style={{
            width: size.w,
            height: size.h,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            ...(rect && rect.h > 0 ? { ['--aspect' as string]: String(rect.w / rect.h) } : null),
            ...(typeSize ? { ['--type' as string]: `${typeSize * (117 / 72)}px` } : null),
          }}
        >
          <Fastener item={item} />
          <div className="surface">
            <Contents item={item} media={media} today={today} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default FramePreview;
