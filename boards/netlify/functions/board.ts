import type { Config } from '@netlify/functions';
import { boardIdFor, forbidden, json, notFound, sessionFor, unauthorized } from './_lib/auth';
import { emptyBoard, expiryOf, loadBoard, saveBoard, touchBoard } from './_lib/store';
import { titleObjection } from './_lib/naming';
import {
  boardStyle,
  FRAME_STYLES,
  HANGER_STYLES,
  LINE_KINDS,
  MAX_BOARD_PICTURES,
  MAX_TYPE_PT,
  MIN_TYPE_PT,
  MAX_GALLERY,
  MAX_LINES,
  MAGNET_FINISHES,
  type BoardItem,
  type BoardLine,
  type BoardLineKind,
  type BoardState,
  type MagnetFinish,
  type FrameStyle,
  type HangerStyle,
} from '../../shared/types';
import { isCalendarDate, isTimeZone } from '../../shared/clock';

const MAX_ITEMS = 400;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined;

/** Every picture on a board, counted across all of its items. */
function countPictures(items: BoardItem[]): number {
  return items.reduce(
    (total, item) => total + (item.mediaIds?.length ?? (item.mediaId ? 1 : 0)),
    0,
  );
}

/**
 * A whiteboard's live lines, rebuilt the same way its item is.
 *
 * Only the inputs are stored - the kind, the label, the day being counted to.
 * The number itself is never taken from the request, because it is never
 * stored: it is worked out afresh every time the board is drawn.
 */
function sanitizeLine(raw: unknown, index: number): BoardLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as Record<string, unknown>;
  const kind = LINE_KINDS.includes(line.kind as BoardLineKind)
    ? (line.kind as BoardLineKind)
    : null;
  if (!kind) return null;
  return {
    id: typeof line.id === 'string' && line.id ? line.id.slice(0, 64) : `line-${index}`,
    kind,
    label: str(line.label, 60),
    date: isCalendarDate(line.date) ? line.date : undefined,
  };
}

/**
 * Rebuilds each item from the request rather than trusting it wholesale, so a
 * malformed or hostile payload cannot poison the stored board.
 */
function sanitizeItem(raw: unknown, index: number): BoardItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' && item.id ? item.id.slice(0, 64) : null;
  if (!id) return null;
  const frame = FRAME_STYLES.includes(item.frame as FrameStyle) ? (item.frame as FrameStyle) : 'paper';
  const hanger = HANGER_STYLES.includes(item.hanger as HangerStyle)
    ? (item.hanger as HangerStyle)
    : 'pin';
  return {
    id,
    mediaId: typeof item.mediaId === 'string' ? item.mediaId.slice(0, 64) : undefined,
    mediaIds: Array.isArray(item.mediaIds)
      ? item.mediaIds
          .filter((id): id is string => typeof id === 'string')
          .slice(0, MAX_GALLERY)
          .map((id) => id.slice(0, 64))
      : undefined,
    aspect: typeof item.aspect === 'number' && item.aspect > 0 ? item.aspect : undefined,
    heading: str(item.heading, 200),
    caption: str(item.caption, 160),
    typeSize:
      typeof item.typeSize === 'number' && Number.isFinite(item.typeSize)
        ? Math.min(MAX_TYPE_PT, Math.max(MIN_TYPE_PT, Math.round(item.typeSize)))
        : undefined,
    body: str(item.body, 2000),
    lines: Array.isArray(item.lines)
      ? item.lines
          .slice(0, MAX_LINES)
          .map((line, at) => sanitizeLine(line, at))
          .filter((line): line is BoardLine => line !== null)
      : undefined,
    x: Math.round(num(item.x, 0)),
    y: Math.round(num(item.y, 0)),
    w: Math.max(40, Math.round(num(item.w, 240))),
    h: Math.max(40, Math.round(num(item.h, 240))),
    rotation: Math.max(-25, Math.min(25, num(item.rotation, 0))),
    frame,
    hanger,
    // Plain hex only. This ends up in a custom property that the stylesheet
    // substitutes into a background, and anything else there is somebody
    // else's CSS - or somebody else's URL - running on the page.
    pinColor: /^#[0-9a-f]{6}$/i.test(String(item.pinColor)) ? String(item.pinColor) : undefined,
    finish: MAGNET_FINISHES.includes(item.finish as MagnetFinish)
      ? (item.finish as MagnetFinish)
      : undefined,
    z: Math.round(num(item.z, index)),
    createdAt:
      typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : new Date().toISOString(),
  };
}

export default async (req: Request): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  const boardId = await boardIdFor(req, session);

  if (req.method === 'GET') {
    const board = await loadBoard(boardId);
    if (!board) return session.master ? json(emptyBoard(boardId)) : notFound();
    // Looking counts as keeping it: a board only expires if truly abandoned.
    await touchBoard(boardId);
    return json({ ...board, expiresAt: expiryOf(board) });
  }

  if (req.method === 'PUT') {
    if (session.role !== 'editor') return forbidden();
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    const current = (await loadBoard(boardId)) ?? emptyBoard(boardId);

    // A rename has to clear the same bar as a new board, or the guard on
    // creation is worth nothing: name it plainly, then rename it afterwards.
    // Leaving the title alone never trips this, so an ordinary save cannot
    // fail on it.
    const title = str(body.title, 120) ?? current.title;
    if (!session.master && title !== current.title) {
      const objection = titleObjection(title);
      if (objection) return json({ error: objection }, { status: 409 });
    }

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    const items = rawItems
      .map((item, index) => sanitizeItem(item, index))
      .filter((item): item is BoardItem => item !== null);

    // Refused rather than trimmed: quietly dropping the pictures over the
    // line would delete somebody's work on a save they did not know was too
    // big. A board already over the limit - one filled before there was one -
    // can still be saved as long as the save does not add to it, so the way
    // to fix it is never blocked by the rule itself.
    const pictures = countPictures(items);
    if (pictures > MAX_BOARD_PICTURES && pictures > countPictures(current.items)) {
      return json(
        {
          error: `That would put ${pictures} pictures on this board, and one board holds ${MAX_BOARD_PICTURES}. Take some down first.`,
        },
        { status: 409 },
      );
    }

    const next: BoardState = {
      version: 1,
      id: boardId,
      createdAt: current.createdAt,
      // Never taken from the request: an editor saving their board must not be
      // able to promote it, or file it among the site's own, by including the
      // field.
      official: current.official,
      house: current.house,
      width: Math.max(1200, Math.round(num(body.width, current.width))),
      height: Math.max(800, Math.round(num(body.height, current.height))),
      title,
      // A zone this runtime does not recognise is dropped rather than stored,
      // so a whiteboard can never be left counting against nothing.
      timeZone: isTimeZone(body.timeZone) ? body.timeZone : current.timeZone,
      style: boardStyle(body.style) ?? current.style,
      submissions: typeof body.submissions === 'boolean' ? body.submissions : current.submissions,
      // Only a plain hex colour: this ends up in a style attribute, and
      // anything else there is somebody else's CSS running on the page.
      wall: /^#[0-9a-f]{6}$/i.test(String(body.wall)) ? String(body.wall) : current.wall,
      items,
      updatedAt: current.updatedAt,
    };
    const saved = await saveBoard({ ...next, lastSeenAt: new Date().toISOString() });
    return json({ ...saved, expiresAt: expiryOf(saved) });
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: '/api/board' };
