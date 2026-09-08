import type { Config } from '@netlify/functions';
import { forbidden, json, roleFor, unauthorized } from './_lib/auth';
import { loadBoard, saveBoard } from './_lib/store';
import type { BoardItem, BoardState, FrameStyle, HangerStyle } from '../../shared/types';

const FRAMES: FrameStyle[] = ['paper', 'polaroid', 'clipping', 'framed', 'note'];
const HANGERS: HangerStyle[] = ['pin', 'tape', 'nail', 'none'];
const MAX_ITEMS = 400;

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const str = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined;

/**
 * Rebuilds each item from the request rather than trusting it wholesale, so a
 * malformed or hostile payload cannot poison the stored board.
 */
function sanitizeItem(raw: unknown, index: number): BoardItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' && item.id ? item.id.slice(0, 64) : null;
  if (!id) return null;
  const frame = FRAMES.includes(item.frame as FrameStyle) ? (item.frame as FrameStyle) : 'paper';
  const hanger = HANGERS.includes(item.hanger as HangerStyle)
    ? (item.hanger as HangerStyle)
    : 'pin';
  return {
    id,
    mediaId: typeof item.mediaId === 'string' ? item.mediaId.slice(0, 64) : undefined,
    aspect: typeof item.aspect === 'number' && item.aspect > 0 ? item.aspect : undefined,
    caption: str(item.caption, 200),
    body: str(item.body, 2000),
    x: Math.round(num(item.x, 0)),
    y: Math.round(num(item.y, 0)),
    w: Math.max(40, Math.round(num(item.w, 240))),
    h: Math.max(40, Math.round(num(item.h, 240))),
    rotation: Math.max(-25, Math.min(25, num(item.rotation, 0))),
    frame,
    hanger,
    pinColor: typeof item.pinColor === 'string' ? item.pinColor.slice(0, 24) : undefined,
    z: Math.round(num(item.z, index)),
    createdAt:
      typeof item.createdAt === 'string' ? item.createdAt.slice(0, 40) : new Date().toISOString(),
  };
}

export default async (req: Request): Promise<Response> => {
  const role = roleFor(req);
  if (!role) return unauthorized();

  if (req.method === 'GET') {
    return json(await loadBoard());
  }

  if (req.method === 'PUT') {
    if (role !== 'editor') return forbidden();
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    const current = await loadBoard();
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    const items = rawItems
      .map((item, index) => sanitizeItem(item, index))
      .filter((item): item is BoardItem => item !== null);

    const next: BoardState = {
      version: 1,
      width: Math.max(1200, Math.round(num(body.width, current.width))),
      height: Math.max(800, Math.round(num(body.height, current.height))),
      title: str(body.title, 120) ?? current.title,
      items,
      updatedAt: current.updatedAt,
    };
    return json(await saveBoard(next));
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: '/api/board' };
