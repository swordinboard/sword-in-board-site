/** Shapes shared between the browser app and the Netlify functions. */

export type FrameStyle = 'paper' | 'polaroid' | 'clipping' | 'framed' | 'note';
export type HangerStyle = 'pin' | 'tape' | 'nail' | 'none';
export type Role = 'viewer' | 'editor';

export interface BoardItem {
  id: string;
  /** Blob id of the cropped image, if this item has one. */
  mediaId?: string;
  /** Natural aspect of the stored image, used to size without a layout shift. */
  aspect?: number;
  caption?: string;
  /** Text body, for note and paper items that carry writing instead of media. */
  body?: string;
  /** Position of the item's top-left corner in board coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tilt in degrees. Small values read as "hung by hand". */
  rotation: number;
  frame: FrameStyle;
  hanger: HangerStyle;
  /** Hex colour for the pin head; ignored by tape and nail. */
  pinColor?: string;
  z: number;
  createdAt: string;
}

export interface BoardState {
  version: 1;
  /** Fixed board size in board coordinates. Items never reflow. */
  width: number;
  height: number;
  title: string;
  items: BoardItem[];
  updatedAt: string;
}

export type SubmissionStatus = 'new' | 'reviewed' | 'placed' | 'archived';

export interface Submission {
  id: string;
  createdAt: string;
  submitter: string;
  contact?: string;
  note: string;
  mediaIds: string[];
  status: SubmissionStatus;
}

export interface SessionInfo {
  authenticated: boolean;
  role: Role | null;
}

export const BOARD_DEFAULTS = {
  width: 4200,
  height: 3000,
  title: 'Bulletin Board',
} as const;

export const PIN_COLORS = [
  '#c0392b',
  '#d68910',
  '#2e86c1',
  '#27795b',
  '#7d3c98',
  '#f4f1ea',
] as const;
