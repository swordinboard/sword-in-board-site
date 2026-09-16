import type { Config } from '@netlify/functions';
import {
  agreedCookie,
  clearCookie,
  issueToken,
  json,
  masterPassword,
  misconfigured,
  readAgreed,
  safeEqual,
  sessionCookie,
  sessionFor,
} from './_lib/auth';
import { hasAgreed, withAgreed } from '../../shared/types';
import {
  allowAttempt,
  clearAttempts,
  createKey,
  ensureBoard,
  keyForPassword,
  loadBoard,
  touchKey,
} from './_lib/store';
import { IP_LIMIT, IP_WINDOW_MS, noteFailure } from './_lib/guard';

/**
 * The password was right but this device has not agreed for this board yet.
 *
 * A status of its own rather than an error: the screen needs to tell the two
 * apart, because one means try a different password and the other means read
 * this and tick the box.
 */
const mustAgree = (boardTitle?: string) =>
  json(
    {
      needsAgreement: true,
      boardTitle,
      error: 'Please read the site rules and confirm before coming in.',
    },
    { status: 409 },
  );

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
  // First line: bounds what any single source can guess, and what it can cost.
  if (!(await allowAttempt(`login:${ip}`, IP_LIMIT, IP_WINDOW_MS))) {
    return json({ error: 'Too many attempts. Try again in a little while.' }, { status: 429 });
  }

  let password = '';
  let agreeing = false;
  try {
    const body = (await req.json()) as { password?: unknown; agreed?: unknown };
    if (typeof body.password === 'string') password = body.password;
    agreeing = body.agreed === true;
  } catch {
    return json({ error: 'bad request' }, { status: 400 });
  }
  if (!password) return json({ error: 'A password is required.' }, { status: 400 });

  const agreedSoFar = readAgreed(req);

  /*
   * Whether this person still has to say yes, for the board they are opening.
   *
   * The passphrase is what picks the board, so until it resolves the site has
   * no idea which board this is - which is why the ask cannot live on the
   * screen before the password. It lands here instead, once, per board, and
   * the cookie beside the session remembers it.
   */
  const needsAgreement = (boardId: string | null) =>
    !hasAgreed(agreedSoFar, boardId) && !agreeing;

  // The master password is checked first: it opens everything, and must keep
  // working even before any access key has been made.
  if (safeEqual(password, master)) {
    await clearAttempts(`login:${ip}`);
    if (needsAgreement(null)) return mustAgree();
    await ensureBoard();
    const token = await issueToken({ r: 'editor', m: true, b: null, k: null });
    return json(
      { authenticated: true, role: 'editor', master: true, boardId: null },
      {
        headers: [
          ['set-cookie', sessionCookie(token)],
          ['set-cookie', agreedCookie(withAgreed(agreedSoFar, 'site'))],
        ],
      },
    );
  }

  // Otherwise the password itself says which board to open.
  await seedLegacyPassword();
  const key = await keyForPassword(password);

  if (!key) {
    // Only wrong answers meet the site-wide ceiling, and only after the
    // password has been resolved. A correct password is never refused, however
    // hard the site is being guessed at.
    const guard = await noteFailure(new URL(req.url).origin);
    if (guard.tripped) {
      return json(
        {
          error: 'Too many wrong passwords across this site just now. Try again shortly.',
          challenge: true,
        },
        { status: 429 },
      );
    }
    return json({ error: 'That password does not open any board.' }, { status: 401 });
  }

  const board = await loadBoard(key.boardId);
  if (!board) {
    return json({ error: 'The board this password opened is no longer here.' }, { status: 410 });
  }

  await clearAttempts(`login:${ip}`);
  // The password was right, so nothing here is a guess any more. Asking them
  // to agree happens before the key is marked used and before a session
  // exists: somebody who closes the panel has not been let in.
  if (needsAgreement(key.boardId)) return mustAgree(board.title);

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
    {
      headers: [
        ['set-cookie', sessionCookie(token)],
        ['set-cookie', agreedCookie(withAgreed(agreedSoFar, key.boardId))],
      ],
    },
  );
};

export const config: Config = { path: '/api/auth' };
