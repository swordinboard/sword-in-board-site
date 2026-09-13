import { FRAME_STYLES, type FrameStyle, type HangerStyle } from '../../shared/types';

/**
 * What a frame is for.
 *
 * A frame is not a neutral border - an instant photo with no photograph in it
 * is just a white rectangle, and a sticky note with a photograph on it is not
 * a sticky note. So the frame decides what may go in it, and the add dialog
 * stops offering the other thing.
 */
export type FrameHolds = 'image' | 'text' | 'either' | 'gallery';

/**
 * Board pixels to the inch.
 *
 * The board had no scale at all: every size was picked by eye, so a photo
 * came out the size of a postage stamp next to a sheet of paper and nothing
 * agreed with anything. A default board is 4200 by 3000, and a corkboard
 * that shape is about 36 inches across, which fixes the rest.
 */
export const PX_PER_INCH = 117;

/** A real-world measurement, in board pixels. */
export const inches = (value: number) => Math.round(value * PX_PER_INCH);

export interface FrameSpec {
  label: string;
  blurb: string;
  holds: FrameHolds;
  /**
   * How wide this is in the real world, which is what it is drawn at when it
   * first goes up. An instant photo is three and a half inches across
   * whatever else is on the board, and a whiteboard is not.
   */
  inchesWide: number;
  /**
   * For a frame shown closed, how tall its face is against its own width.
   *
   * A folder and a magazine are objects in their own right: they hold
   * pictures but they are not shaped by them, so the aspect of whatever
   * happens to be on top has no business deciding how tall they are.
   */
  coverShape?: number;
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
    holds: 'text',
    inchesWide: 8.5,
    padX: 12,
    padTop: 12,
    padBottom: 12,
    defaultHanger: 'pin',
    tiltRange: 3,
  },
  polaroid: {
    label: 'Instant photo',
    blurb: 'White border, heavy at the bottom.',
    holds: 'image',
    inchesWide: 3.5,
    padX: 23,
    padTop: 23,
    padBottom: 94,
    defaultHanger: 'pin',
    tiltRange: 5,
  },
  clipping: {
    label: 'Clipping',
    blurb: 'Torn newsprint, slightly yellowed.',
    holds: 'either',
    inchesWide: 5,
    padX: 10,
    padTop: 10,
    padBottom: 10,
    defaultHanger: 'tape',
    tiltRange: 4,
  },
  framed: {
    label: 'Framed',
    blurb: 'Wood moulding, mat, and glass.',
    holds: 'image',
    inchesWide: 7,
    padX: 70,
    padTop: 70,
    padBottom: 70,
    defaultHanger: 'nail',
    tiltRange: 1,
  },
  note: {
    label: 'Sticky note',
    blurb: 'For writing rather than pictures.',
    holds: 'text',
    inchesWide: 3,
    padX: 18,
    padTop: 20,
    padBottom: 20,
    defaultHanger: 'pin',
    tiltRange: 6,
  },
  lined: {
    label: 'Notebook page',
    blurb: 'Ruled paper, torn from the binding.',
    holds: 'text',
    inchesWide: 8,
    // Room down the side for the torn edge and the margin rule.
    padX: 30,
    padTop: 20,
    padBottom: 20,
    defaultHanger: 'tape',
    tiltRange: 4,
  },
  folder: {
    label: 'Folder',
    blurb: 'A set of pictures, in a manila folder.',
    holds: 'gallery',
    inchesWide: 9.5,
    coverShape: 0.76,
    padX: 47,
    // The tab stands above the folder body.
    padTop: 58,
    padBottom: 41,
    defaultHanger: 'pin',
    tiltRange: 2,
  },
  magazine: {
    label: 'Magazine',
    blurb: 'A set of pictures, with the first as the cover.',
    holds: 'gallery',
    inchesWide: 8.25,
    // 8.25 by 10.75 overall, once the masthead and the foot are taken off.
    coverShape: 1.272,
    padX: 18,
    padTop: 18,
    padBottom: 58,
    defaultHanger: 'none',
    tiltRange: 2,
  },
  whiteboard: {
    label: 'Whiteboard',
    blurb: 'Write on it, or let it keep the date and the count.',
    holds: 'text',
    inchesWide: 16,
    padX: 64,
    padTop: 50,
    // Room for the tray along the bottom.
    padBottom: 95,
    defaultHanger: 'nail',
    // A board screwed to the wall hangs straight.
    tiltRange: 0.6,
  },
};

/** Whether this frame will take a picture at all. */
export const takesImage = (frame: FrameStyle) =>
  FRAME_SPECS[frame].holds === 'image' || FRAME_SPECS[frame].holds === 'either';

/** Whether this frame will take writing at all. */
export const takesText = (frame: FrameStyle) =>
  FRAME_SPECS[frame].holds === 'text' || FRAME_SPECS[frame].holds === 'either';

/**
 * Starting size for a written item, which has no media to take its shape
 * from, so it is drawn at the size the thing itself is.
 */
const TEXT_SHAPE: Partial<Record<FrameStyle, number>> = {
  // A letter sheet, a notebook page, a square sticky note, and a whiteboard
  // that is wider than it is tall the way every one on a wall is.
  paper: 11 / 8.5,
  lined: 10.5 / 8,
  clipping: 7 / 5,
  note: 1,
  whiteboard: 10.7 / 16,
};

export function textSizeFor(frame: FrameStyle): { w: number; h: number } {
  const spec = FRAME_SPECS[frame];
  const w = inches(spec.inchesWide);
  return { w, h: Math.round(w * (TEXT_SHAPE[frame] ?? 1)) };
}

/** Offered in this order; the canonical list, so a new frame appears here. */
export const FRAME_ORDER: FrameStyle[] = FRAME_STYLES;

export const HANGER_LABELS: Record<HangerStyle, string> = {
  pin: 'Pushpin',
  tape: 'Tape',
  nail: 'Nail',
  magnetBar: 'Bar magnet',
  magnetDisc: 'Round magnet',
  none: 'Nothing',
};

/**
 * Outer size for an item, derived from the media's aspect and the frame's
 * chrome, so the picture inside lands at its true proportions.
 */
export function sizeFor(
  frame: FrameStyle,
  aspect: number,
  outerWidth?: number,
): { w: number; h: number } {
  const spec = FRAME_SPECS[frame];
  outerWidth = outerWidth ?? inches(spec.inchesWide);
  /*
   * The chrome scales with the item rather than staying a fixed number of
   * pixels, which is what makes resizing a true zoom of the whole object:
   * the picture inside keeps the shape it was cropped to AND the item keeps
   * the shape it had. With a fixed border only the first held, so a
   * photograph pulled larger slowly became a different shape - a wide white
   * mount turning into a thin one.
   */
  const k = outerWidth / inches(spec.inchesWide);
  const padX = spec.padX * k;
  const padTop = spec.padTop * k;
  const padBottom = spec.padBottom * k;
  const innerWidth = Math.max(20, outerWidth - padX * 2);
  // Anything shown closed keeps its own shape whatever is filed in it, rather
  // than taking the aspect of whichever picture happens to be on top.
  const innerHeight = spec.coverShape
    ? innerWidth * spec.coverShape
    : innerWidth / (aspect > 0 ? aspect : 1);
  return {
    w: Math.round(outerWidth),
    h: Math.round(innerHeight + padTop + padBottom),
  };
}

/** A small, stable-feeling tilt so hung items never look machine-placed. */
export function randomTilt(frame: FrameStyle): number {
  const range = FRAME_SPECS[frame].tiltRange;
  return Math.round((Math.random() * 2 - 1) * range * 10) / 10;
}
