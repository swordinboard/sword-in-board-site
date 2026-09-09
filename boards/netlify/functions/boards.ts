import type { Config, Context } from '@netlify/functions';
import { forbidden, json, notFound, sessionFor, unauthorized } from './_lib/auth';
import {
  countKeys,
  deleteBoard,
  emptyBoard,
  ensureBoard,
  listBoards,
  loadBoard,
  newId,
  saveBoard,
} from './_lib/store';
import type { BoardSummary } from '../../shared/types';

const MAX_BOARDS = 50;

/**
 * Board management, master editor only. A key-backed session never learns that
 * any board but its own exists.
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  if (!session.master) return forbidden();

  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'GET') {
    await ensureBoard();
    const boards = await listBoards();
    const summaries: BoardSummary[] = await Promise.all(
      boards.map(async (board) => ({
        id: board.id,
        title: board.title,
        itemCount: board.items.length,
        official: board.official,
        keyCount: await countKeys(board.id),
        updatedAt: board.updatedAt,
      })),
    );
    return json({ boards: summaries });
  }

  if (req.method === 'POST') {
    const boards = await listBoards();
    if (boards.length >= MAX_BOARDS) {
      return json({ error: `That is the limit of ${MAX_BOARDS} boards.` }, { status: 409 });
    }
    let title = '';
    try {
      const body = (await req.json()) as { title?: unknown };
      if (typeof body.title === 'string') title = body.title.trim().slice(0, 120);
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    if (!title) return json({ error: 'Give the board a name.' }, { status: 400 });
    const board = await saveBoard(emptyBoard(newId(), title));
    return json(board, { status: 201 });
  }

  if (req.method === 'PATCH') {
    if (!id) return notFound();
    const board = await loadBoard(id);
    if (!board) return notFound();
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : board.title;
    // Only reachable by the master, which is what makes the badge mean
    // anything: it is the one mark a board's own owner cannot give itself.
    const official =
      typeof body.official === 'boolean' ? body.official : Boolean(board.official);
    return json(await saveBoard({ ...board, title, official }));
  }

  if (req.method === 'DELETE') {
    if (!id) return notFound();
    const board = await loadBoard(id);
    if (!board) return notFound();
    const boards = await listBoards();
    if (boards.length <= 1) {
      return json({ error: 'This is the only board. Make another before removing it.' }, { status: 409 });
    }
    await deleteBoard(id);
    return json({ deleted: true });
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/boards', '/api/boards/:id'] };
