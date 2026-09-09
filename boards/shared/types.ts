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
  createdAt?: string;
  /**
   * Last time anyone looked at or changed this board. Viewing counts, so a
   * board only ever expires if it is genuinely abandoned.
   */
  lastSeenAt?: string;
  /** When this board will be cleared if nobody touches it. */
  expiresAt?: string;
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

/**
 * A floor against collision rather than against guessing. Very short passwords
 * start colliding with what other people happen to type, which would drop a
 * stranger onto somebody's board by accident.
 */
export const KEY_MIN_LENGTH = 6;

/** Who may put up a new board. */
export type SignupMode = 'closed' | 'invite' | 'open';

/** What the login screen needs to know before anyone has signed in. */
export interface SiteInfo {
  signupMode: SignupMode;
  /** True when a board can be made right now, with or without a code. */
  canCreate: boolean;
  /** True when making one needs an invite code. */
  needsInvite: boolean;
  /** Days of being untouched before a board is cleared. */
  ttlDays: number;
  /** True when a forgotten passphrase can be emailed back. */
  recoveryAvailable: boolean;
  title: string;
}

/** A code that lets someone put up a board while signups are invite-only. */
export interface Invite {
  id: string;
  label: string;
  /** Returned only to the master editor. */
  code?: string;
  maxUses: number;
  uses: number;
  createdAt: string;
  lastUsedAt?: string;
}

/** What comes back after putting up a new board. */
export interface NewBoardResult {
  board: BoardState;
  /** The owner's passphrase. Shown once; never recoverable without an email. */
  passphrase: string;
  recoveryEmailSaved: boolean;
}

/**
 * Below this many bits a password is called weak and has to be confirmed.
 *
 * It is advice, not a wall. Boards sit on a spectrum: some are genuinely
 * private, others are meant to be handed round freely and want a password as
 * memorable as the board's own name. Since a password opens exactly one board,
 * a weak one risks only the board that chose it, so the choice belongs to
 * whoever owns it. A generated passphrase is about 42 bits.
 */
export const KEY_MIN_BITS = 32;

export const BOARD_DEFAULTS = {
  width: 4200,
  height: 3000,
  /** Only ever seen by a board made without a name; authors name their own. */
  title: 'Untitled Board',
} as const;

/** What the app itself is called. Override per instance with SITE_NAME. */
export const SITE_DEFAULT_NAME = 'Borough Boards';

export const PIN_COLORS = [
  '#c0392b',
  '#d68910',
  '#2e86c1',
  '#27795b',
  '#7d3c98',
  '#f4f1ea',
] as const;
