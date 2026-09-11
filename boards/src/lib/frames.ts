import { FRAME_STYLES, type FrameStyle, type HangerStyle } from '../../shared/types';

export interface FrameSpec {
  label: string;
  blurb: string;
  /** Chrome around the media, in board pixels, matching frames.css. */
  padX: number;
  padTop: number;
  padBottom: number;
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
    defaultHanger: 'pin',
    tiltRange: 3,
  },
  polaroid: {
    label: 'Instant photo',
    blurb: 'White border, heavy at the bottom.',
    padX: 12,
    padTop: 12,
    padBottom: 46,
    defaultHanger: 'pin',
    tiltRange: 5,
  },
  clipping: {
    label: 'Clipping',
    blurb: 'Torn newsprint, slightly yellowed.',
    padX: 9,
    padTop: 9,
    padBottom: 9,
    defaultHanger: 'tape',
    tiltRange: 4,
  },
  framed: {
    label: 'Framed',
    blurb: 'Wood moulding, mat, and glass.',
    padX: 19,
    padTop: 19,
    padBottom: 19,
    defaultHanger: 'nail',
    tiltRange: 1,
  },
  note: {
    label: 'Sticky note',
    blurb: 'For writing rather than pictures.',
    padX: 14,
    padTop: 16,
    padBottom: 16,
    defaultHanger: 'pin',
    tiltRange: 6,
  },
  lined: {
    label: 'Notebook page',
    blurb: 'Ruled paper, torn out along the top.',
    padX: 16,
    // Room at the top for the torn edge, which eats into the sheet.
    padTop: 26,
    padBottom: 16,
    defaultHanger: 'tape',
    tiltRange: 4,
  },
  folder: {
    label: 'Folder',
    blurb: 'A set of pictures, in a manila folder.',
    padX: 12,
    // The tab stands above the folder body.
    padTop: 22,
    padBottom: 14,
    defaultHanger: 'pin',
    tiltRange: 2,
  },
  magazine: {
    label: 'Magazine',
    blurb: 'A set of pictures, with the first as the cover.',
    padX: 10,
    padTop: 10,
    padBottom: 34,
    defaultHanger: 'none',
    tiltRange: 2,
  },
};

/** Offered in this order; the canonical list, so a new frame appears here. */
export const FRAME_ORDER: FrameStyle[] = FRAME_STYLES;

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
  outerWidth = 280,
): { w: number; h: number } {
  const spec = FRAME_SPECS[frame];
  const innerWidth = Math.max(20, outerWidth - spec.padX * 2);
  // A folder shows its contents closed, so it keeps a steady shape whatever
  // is filed in it rather than taking the aspect of the top sheet.
  const innerHeight = frame === 'folder' ? innerWidth * 0.76 : innerWidth / (aspect > 0 ? aspect : 1);
  return {
    w: Math.round(outerWidth),
    h: Math.round(innerHeight + spec.padTop + spec.padBottom),
  };
}

/** A small, stable-feeling tilt so hung items never look machine-placed. */
export function randomTilt(frame: FrameStyle): number {
  const range = FRAME_SPECS[frame].tiltRange;
  return Math.round((Math.random() * 2 - 1) * range * 10) / 10;
}
