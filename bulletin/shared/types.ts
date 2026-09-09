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
  id: string;
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
  /** The board the submitter was looking at when they sent this. */
  boardId: string;
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
  /**
   * True when the session came from the master editor password in the
   * environment, which opens every board rather than one.
   */
  master: boolean;
  /** The board this session's key opens. Null for the master editor. */
  boardId: string | null;
}

/** What the master editor sees when listing boards. */
export interface BoardSummary {
  id: string;
  title: string;
  itemCount: number;
  keyCount: number;
  updatedAt: string;
}

/** A password that opens one board, at one role. */
export interface AccessKey {
  id: string;
  boardId: string;
  /** Who this key was made for, so it can be revoked by name later. */
  label: string;
  role: Role;
  createdAt: string;
  lastUsedAt?: string;
  /**
   * The password itself. Stored encrypted and returned only to the master
   * editor, so a key can be read back weeks after it was handed out.
   */
  secret?: string;
}

export const KEY_MIN_LENGTH = 8;

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
