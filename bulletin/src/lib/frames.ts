import type { FrameStyle, HangerStyle } from '../../shared/types';

export interface FrameSpec {
  label: string;
  blurb: string;
  /** Chrome around the media, in board pixels, matching frames.css. */
  padX: number;
  padTop: number;
  padBottom: number;
  /** Extra height reserved when the item carries a caption. */
  captionHeight: number;
  defaultHanger: HangerStyle;
  /** Some frames read better with a stronger tilt than others. */
  tiltRange: number;
}

export const FRAME_SPECS: Record<FrameStyle, FrameSpec> = {
  paper: {
    label: 'Paper',
    blurb: 'A plain sheet, pinned flat.',
    padX: 10,
    padTop: 10,
    padBottom: 10,
    captionHeight: 26,
    defaultHanger: 'pin',
    tiltRange: 3,
  },
  polaroid: {
    label: 'Instant photo',
    blurb: 'White border, heavy at the bottom.',
    padX: 12,
    padTop: 12,
    padBottom: 46,
    captionHeight: 0,
    defaultHanger: 'pin',
    tiltRange: 5,
  },
  clipping: {
    label: 'Clipping',
    blurb: 'Torn newsprint, slightly yellowed.',
    padX: 9,
    padTop: 9,
    padBottom: 9,
    captionHeight: 24,
    defaultHanger: 'tape',
    tiltRange: 4,
  },
  framed: {
    label: 'Framed',
    blurb: 'Wood moulding, mat, and glass.',
    padX: 19,
    padTop: 19,
    padBottom: 19,
    captionHeight: 0,
    defaultHanger: 'nail',
    tiltRange: 1,
  },
  note: {
    label: 'Sticky note',
    blurb: 'For writing rather than pictures.',
    padX: 14,
    padTop: 16,
    padBottom: 16,
    captionHeight: 26,
    defaultHanger: 'pin',
    tiltRange: 6,
  },
};

export const FRAME_ORDER: FrameStyle[] = ['paper', 'polaroid', 'clipping', 'framed', 'note'];

export const HANGER_LABELS: Record<HangerStyle, string> = {
  pin: 'Pushpin',
  tape: 'Tape',
  nail: 'Nail',
  none: 'Nothing',
};

/**
 * Outer size for an item, derived from the media's aspect and the frame's
 * chrome, so the picture inside lands at its true proportions.
 */
export function sizeFor(
  frame: FrameStyle,
  aspect: number,
  hasCaption: boolean,
  outerWidth = 280,
): { w: number; h: number } {
  const spec = FRAME_SPECS[frame];
  const innerWidth = Math.max(20, outerWidth - spec.padX * 2);
  const innerHeight = innerWidth / (aspect > 0 ? aspect : 1);
  const caption = hasCaption ? spec.captionHeight : 0;
  return {
    w: Math.round(outerWidth),
    h: Math.round(innerHeight + spec.padTop + spec.padBottom + caption),
  };
}

/** A small, stable-feeling tilt so hung items never look machine-placed. */
export function randomTilt(frame: FrameStyle): number {
  const range = FRAME_SPECS[frame].tiltRange;
  return Math.round((Math.random() * 2 - 1) * range * 10) / 10;
}
