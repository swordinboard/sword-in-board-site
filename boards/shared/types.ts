/** Shapes shared between the browser app and the Netlify functions. */

export type FrameStyle =
  | 'paper'
  | 'polaroid'
  | 'clipping'
  | 'framed'
  | 'note'
  | 'lined'
  | 'folder'
  | 'magazine'
  | 'whiteboard';

/**
 * Every frame there is, as a value.
 *
 * The one list, shared by the browser and the function that validates a save.
 * There used to be a second copy in board.ts, and when these frames were added
 * it was not updated - so the server quietly rewrote every folder, magazine
 * and notebook page to `paper` on the way to storage, and the item came back
 * as something else entirely after a reload.
 */
export const FRAME_STYLES: FrameStyle[] = [
  'paper',
  'polaroid',
  'clipping',
  'framed',
  'note',
  'lined',
  'folder',
  'magazine',
  'whiteboard',
];

export const HANGER_STYLES: HangerStyle[] = [
  'pin',
  'tape',
  'nail',
  'magnetBar',
  'magnetDisc',
  'none',
];

/** The frames that hold a set of pictures rather than one. */
export const GALLERY_FRAMES: FrameStyle[] = ['folder', 'magazine'];
export type HangerStyle = 'pin' | 'tape' | 'nail' | 'magnetBar' | 'magnetDisc' | 'none';

/**
 * A magnet's finish. Not a colour, because chrome is not one: it is a set of
 * bands running light to dark, and a hex could not say that.
 */
export type MagnetFinish = 'black' | 'chrome';

export const MAGNET_FINISHES: MagnetFinish[] = ['black', 'chrome'];

/** The hangers that take a finish rather than a pin colour. */
export const MAGNET_HANGERS: HangerStyle[] = ['magnetBar', 'magnetDisc'];

/**
 * A line on a whiteboard that works itself out rather than being written.
 *
 * `date` is simply what day it is. `days` counts to or from one particular
 * day - days since the party left town, days until the next session - and
 * reads as a count either way round, so the one kind covers both.
 */
export type BoardLineKind = 'date' | 'days';

export const LINE_KINDS: BoardLineKind[] = ['date', 'days'];

export interface BoardLine {
  id: string;
  kind: BoardLineKind;
  /** Written to the left of the value. A line can go without one. */
  label?: string;
  /** The day a `days` line counts from or to, as YYYY-MM-DD. */
  date?: string;
}

/** The range a chosen type size may take, in points. */
export const MIN_TYPE_PT = 8;
export const MAX_TYPE_PT = 96;

/** Lines one whiteboard may carry. */
export const MAX_LINES = 8;

/**
 * Pictures one folder or magazine may hold.
 *
 * A paging limit before a storage one: a magazine at sixty pictures is thirty
 * page turns and a thumbnail strip with no thumb big enough to hit.
 */
export const MAX_GALLERY = 24;

/**
 * Pictures one board may hold across every item on it.
 *
 * At roughly a third of a megabyte each once they are cropped and re-encoded,
 * this is the ceiling that actually bounds what a single board costs to keep.
 */
export const MAX_BOARD_PICTURES = 200;
export type Role = 'viewer' | 'editor';

export interface BoardItem {
  id: string;
  /** Blob id of the cropped image, if this item has one. */
  mediaId?: string;
  /**
   * A gallery's pictures, in order, for the folder and magazine frames. The
   * first is the one on show - the magazine's cover, the folder's top sheet.
   */
  mediaIds?: string[];
  /** Natural aspect of the stored image, used to size without a layout shift. */
  aspect?: number;
  /**
   * The line across the top of a whiteboard, above whatever else is on it.
   *
   * Only the whiteboard has one. Boards written before the heading and the
   * body were separated kept their heading in `body` and have none of this,
   * which is what the fallback where it is drawn is for.
   */
  heading?: string;
  /** Text body, for note and paper items that carry writing instead of media. */
  body?: string;
  /**
   * Written across the bottom of an instant photo, in the white below the
   * picture. Only that frame has one, because only that frame has the strip
   * of white that a caption goes on.
   */
  caption?: string;
  /**
   * Chosen size for the writing, in points, overriding the size the frame
   * would have worked out for itself. Unset leaves it to the frame.
   */
  typeSize?: number;
  /**
   * Lines a whiteboard works out for itself, drawn under whatever is written
   * on it. Nothing here is ever written back to storage: the numbers are
   * derived when the item is drawn, so they are right whenever anyone looks
   * rather than only just after a save.
   */
  lines?: BoardLine[];
  /** Position of the item's top-left corner in board coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tilt in degrees. Small values read as "hung by hand". */
  rotation: number;
  frame: FrameStyle;
  hanger: HangerStyle;
  /** Hex colour for the pin head; ignored by every other hanger. */
  pinColor?: string;
  /** Finish for a magnet; ignored by every other hanger. */
  finish?: MagnetFinish;
  z: number;
  createdAt: string;
}

export interface BoardState {
  version: 1;
  id: string;
  /**
   * Marks a board as the site's own rather than somebody's. Only the master
   * editor can set it, which is the whole point: it is the one thing a person
   * putting up a board cannot claim for themselves.
   */
  official?: boolean;
  /**
   * One of the site's own boards, as opposed to one somebody signed up for.
   * Purely an organising mark for the developer's own list and never shown to
   * anyone else - separate from `official`, which is a public claim. A board
   * can be the developer's without being presented as the site speaking.
   */
  house?: boolean;
  createdAt?: string;
  /**
   * The clock every whiteboard on this board counts against, as an IANA zone
   * name. One zone for the board rather than each reader's own device, so a
   * table spread across three timezones all see the same day number. Unset
   * falls back to whatever device is doing the reading.
   */
  timeZone?: string;
  /**
   * Whether anyone may send this board a submission. Absent means yes: every
   * board made before there was a switch had one, and taking it away from them
   * on a deploy would be a change nobody asked for.
   */
  submissions?: boolean;
  /** Strings run between items on this board. Absent means none. */
  strings?: BoardString[];
  /**
   * Last time anyone looked at or changed this board. Viewing counts, so a
   * board only ever expires if it is genuinely abandoned.
   */
  lastSeenAt?: string;
  /** When this board will be cleared if nobody touches it. */
  expiresAt?: string;
  /** How the board is dressed. Unset is the plain cork one. */
  style?: BoardStyle;
  /**
   * The wall behind the board, as a hex colour, overriding whatever the
   * style would have used.
   */
  wall?: string;
  /** Fixed board size in board coordinates. Items never reflow. */
  width: number;
  height: number;
  title: string;
  items: BoardItem[];
  updatedAt: string;
}

/**
 * How the board itself is dressed: its surface, the frame around it, and the
 * wall it hangs on. Nothing about the items pinned to it - they keep the
 * frames they were given, so a preset never overrules a choice already made.
 */
export type BoardStyle = 'cork' | 'medieval' | 'scifi' | 'western' | 'industrial';

export const BOARD_STYLES: BoardStyle[] = ['cork', 'medieval', 'scifi', 'western', 'industrial'];

/**
 * Styles that have been renamed, and what they are called now. A board saved
 * under the old name keeps working and heals itself the next time it is
 * saved; without this it would quietly fall back to the plain cork tokens,
 * because nothing in the stylesheet answers to the old name any more.
 */
const RENAMED_STYLES: Record<string, BoardStyle> = { apocalypse: 'industrial' };

export function boardStyle(raw: unknown): BoardStyle | undefined {
  if (typeof raw !== 'string') return undefined;
  if (BOARD_STYLES.includes(raw as BoardStyle)) return raw as BoardStyle;
  return RENAMED_STYLES[raw];
}

/**
 * A string run between two items, tied at the hanger on each.
 *
 * It is a board-level thing rather than a field on either item: a string
 * belongs to neither end, and putting it on one would mean deciding which,
 * then remembering to look at both when drawing.
 */
export interface BoardString {
  id: string;
  /** The two items it runs between. Order carries no meaning. */
  from: string;
  to: string;
  color: StringColor;
}

export type StringColor = 'red' | 'twine' | 'blue' | 'green' | 'black';

export const STRING_COLORS: StringColor[] = ['red', 'twine', 'blue', 'green', 'black'];

/**
 * Enough to map a board without being able to bury it. Each string is drawn
 * every frame, and past a few hundred the cost stops being free.
 */
export const MAX_STRINGS = 400;

/**
 * How much of the strings a reader wants to see. Kept per person and never
 * saved: it is a reading aid like zoom, not a property of the board.
 */
export type StringView = 'full' | 'faint' | 'hidden';

export const STRING_VIEWS: StringView[] = ['full', 'faint', 'hidden'];

/** Whether this board is taking submissions. Absent means it is. */
export const takesSubmissions = (board: { submissions?: boolean }) => board.submissions !== false;

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
   * True when the session came from the developer password in the
   * environment, which opens every board rather than one.
   */
  master: boolean;
  /** The board this session's key opens. Null for the developer. */
  boardId: string | null;
}

/** What the developer sees when listing boards. */
export interface BoardSummary {
  id: string;
  title: string;
  official?: boolean;
  /**
   * One of the site's own boards, as opposed to one somebody signed up for.
   * Purely an organising mark for the developer's own list and never shown to
   * anyone else - separate from `official`, which is a public claim. A board
   * can be the developer's without being presented as the site speaking.
   */
  house?: boolean;
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

/**
 * Passwords only the site's own boards may use.
 *
 * Passwords are the one genuinely scarce, global thing here — they must be
 * unique across every board — so the obvious ones are worth holding back. If a
 * stranger claimed "welcome", then telling anyone "the demo password is
 * welcome" would walk them onto that stranger's board instead.
 *
 * Board titles need no such protection: they are labels, not addresses, and
 * nothing routes by them.
 */
export const RESERVED_PASSWORDS: readonly string[] = [
  'welcome', 'demo', 'example', 'sample', 'help', 'support', 'about', 'info',
  'official', 'admin', 'administrator', 'moderator', 'staff', 'team', 'system',
  'start', 'hello', 'home', 'index', 'main', 'test', 'preview', 'tour',
  'boards', 'board', 'pinhold',
];

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
  /** Present only for a developer session: why mail does or does not work. */
  mail?: MailStatus;
}

/**
 * Whether outgoing mail is actually usable, as opposed to merely configured.
 * Every send in this app fails silently by design - a recovery reply that
 * changed when the address was unknown would leak who has a board here - so
 * without this the operator has no way to find out it is broken.
 */
export interface MailStatus {
  /** An API key is present. */
  hasKey: boolean;
  /** A sender on a verified domain is set. */
  hasSender: boolean;
  /**
   * True when mail can only reach the operator's own inbox: the shared
   * resend.dev sender refuses every other recipient, so recovery for anyone
   * but the operator cannot work until a domain is verified.
   */
  ownInboxOnly: boolean;
}

/** A code that lets someone put up a board while signups are invite-only. */
export interface Invite {
  id: string;
  label: string;
  /** Returned only to the developer. */
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
export const SITE_DEFAULT_NAME = 'Pinhold';

/**
 * Titles nobody but the developer may use, matched exactly once stripped
 * of punctuation and case. A board called "Official" is claiming to speak for
 * the site; "Official Fan Club" plainly is not, so only the bare word is held.
 */
export const RESERVED_TITLES: readonly string[] = [
  'official', 'admin', 'administrator', 'moderator', 'mod', 'support',
  'staff', 'system', 'help', 'helpdesk', 'security', 'billing',
];

/**
 * Why a board was reported. Deliberately confined to things that may be
 * against the law: the site is not in the business of judging taste, only of
 * not hosting crime.
 */
export type ReportReason = 'csam' | 'violence' | 'stolen' | 'other-illegal';

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  {
    value: 'csam',
    label: 'Sexual content involving a child',
    hint: 'Reported and removed immediately, and passed to the authorities.',
  },
  {
    value: 'violence',
    label: 'Threats or incitement to violence',
    hint: 'Credible threats against a person or group.',
  },
  {
    value: 'stolen',
    label: 'Stolen or copyrighted material',
    hint: 'Posted without the right to post it.',
  },
  {
    value: 'other-illegal',
    label: 'Something else against the law',
    hint: 'Say what it is below.',
  },
];

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

export interface Report {
  id: string;
  boardId: string;
  boardTitle: string;
  reason: ReportReason;
  detail: string;
  createdAt: string;
  status: ReportStatus;
  /** Which key the reporter held, so a misused report button is traceable. */
  keyId: string | null;
}

export const PIN_COLORS = [
  '#c0392b',
  '#d68910',
  '#2e86c1',
  '#27795b',
  '#7d3c98',
  '#f4f1ea',
] as const;
