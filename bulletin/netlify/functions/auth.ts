import type { Config } from '@netlify/functions';
import {
  clearCookie,
  issueToken,
  json,
  masterPassword,
  misconfigured,
  safeEqual,
  sessionCookie,
  sessionFor,
} from './_lib/auth';
import {
  allowAttempt,
  createKey,
  ensureBoard,
  keyForPassword,
  loadBoard,
  touchKey,
} from './_lib/store';

const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

async function describe(session: Awaited<ReturnType<typeof sessionFor>>) {
  if (!session) return { authenticated: false, role: null, master: false, boardId: null };
  const boardId = session.master ? null : session.boardId;
  const board = boardId ? await loadBoard(boardId) : null;
  return {
    authenticated: true,
    role: session.role,
    master: session.master,
    boardId,
    boardTitle: board?.title,
  };
}

/**
 * The first release had a single BOARD_PASSWORD in the environment. If one is
 * still set, it becomes an ordinary viewer key on the first board rather than
 * quietly ceasing to work. Delete the variable once the key exists.
 */
async function seedLegacyPassword(): Promise<void> {
  const legacy = process.env.BOARD_PASSWORD?.trim();
  if (!legacy || legacy === masterPassword()) return;
  if (await keyForPassword(legacy)) return;
  const board = await ensureBoard();
  await createKey({
    boardId: board.id,
    label: 'Original board password',
    role: 'viewer',
    password: legacy,
  }).catch(() => undefined);
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'GET') {
    return json(await describe(await sessionFor(req)));
  }

  if (req.method === 'DELETE') {
    return json(
      { authenticated: false, role: null, master: false, boardId: null },
      { headers: { 'set-cookie': clearCookie() } },
    );
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 });
  }

  const master = masterPassword();
  if (!master) return misconfigured();

  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (!(await allowAttempt(`login:${ip}`, ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS))) {
    return json({ error: 'Too many attempts. Try again in a little while.' }, { status: 429 });
  }

  let password = '';
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === 'string') password = body.password;
  } catch {
    return json({ error: 'bad request' }, { status: 400 });
  }
  if (!password) return json({ error: 'A password is required.' }, { status: 400 });

  // The master password is checked first: it opens everything, and must keep
  // working even before any access key has been made.
  if (safeEqual(password, master)) {
    await ensureBoard();
    const token = await issueToken({ r: 'editor', m: true, b: null, k: null });
    return json(
      { authenticated: true, role: 'editor', master: true, boardId: null },
      { headers: { 'set-cookie': sessionCookie(token) } },
    );
  }

  // Otherwise the password itself says which board to open.
  await seedLegacyPassword();
  const key = await keyForPassword(password);
  if (!key) return json({ error: 'That password does not open any board.' }, { status: 401 });

  const board = await loadBoard(key.boardId);
  if (!board) {
    return json({ error: 'The board this password opened is no longer here.' }, { status: 410 });
  }

  await touchKey(key);
  const token = await issueToken({ r: key.role, m: false, b: key.boardId, k: key.id });
  return json(
    {
      authenticated: true,
      role: key.role,
      master: false,
      boardId: key.boardId,
      boardTitle: board.title,
    },
    { headers: { 'set-cookie': sessionCookie(token) } },
  );
};

export const config: Config = { path: '/api/auth' };
