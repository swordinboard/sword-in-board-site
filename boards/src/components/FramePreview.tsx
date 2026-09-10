import type { FrameStyle, HangerStyle } from '../../shared/types';
import type { CropRect } from '../lib/image';
import { sizeFor } from '../lib/frames';
import { Contents, Fastener } from './ItemFace';

interface Props {
  image: HTMLImageElement | null;
  rect: CropRect | null;
  frame: FrameStyle;
  hanger: HangerStyle;
  pinColor?: string;
  caption?: string;
  body?: string;
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
export default function FramePreview({
  image,
  rect,
  frame,
  hanger,
  pinColor,
  caption,
  body,
  max = 190,
}: Props) {
  const aspect = rect && rect.h > 0 ? rect.w / rect.h : 1;
  const size = sizeFor(frame, aspect, Boolean(caption?.trim()));
  const scale = Math.min(1, max / Math.max(size.w, size.h));
  const item = { frame, hanger, pinColor, caption: caption?.trim() || undefined, body: body?.trim() || undefined };

  const media =
    image && rect ? (
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
          className={`item frame-${frame}`}
          style={{
            width: size.w,
            height: size.h,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Fastener item={item} />
          <div className="surface">
            <Contents item={item} media={media} />
          </div>
        </div>
      </div>
    </div>
  );
}
