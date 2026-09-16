import type { Config, Context } from '@netlify/functions';
import {
  forbidden,
  json,
  masterPassword,
  notFound,
  safeEqual,
  sessionFor,
  unauthorized,
} from './_lib/auth';
import { createKey, keyById, listKeys, loadBoard, revokeKey } from './_lib/store';
import { estimateBits, generatePassphrase } from './_lib/secrets';
import {
  KEY_MIN_BITS,
  KEY_MIN_LENGTH,
  RESERVED_PASSWORDS,
  type Role,
} from '../../shared/types';

const MAX_KEYS_PER_BOARD = 40;

const isReserved = (password: string) =>
  RESERVED_PASSWORDS.includes(password.trim().toLowerCase().replace(/\s+/g, '-'));

/**
 * Access keys.
 *
 * The master editor manages keys on any board. Whoever holds an editor key
 * manages keys on their own board and no other — they own that board, and the
 * menu has always offered them this.
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  if (session.role !== 'editor') return forbidden();

  const id = (context.params as Record<string, string | undefined>)?.id;
  /** A board this session is allowed to touch, or null. */
  const scopeFor = (boardId: string | null | undefined): string | null => {
    if (session.master) return boardId ?? null;
    if (!boardId || boardId === session.boardId) return session.boardId;
    return null;
  };

  if (req.method === 'GET') {
    const asked = new URL(req.url).searchParams.get('board');
    const boardId = scopeFor(asked);
    if (!session.master && !boardId) return forbidden();
    return json({ keys: await listKeys(boardId ?? undefined) });
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }

    const boardId = scopeFor(typeof body.boardId === 'string' ? body.boardId : null);
    if (!boardId) return forbidden();
    const board = await loadBoard(boardId);
    if (!board) return notFound();

    const existing = await listKeys(boardId);
    if (existing.length >= MAX_KEYS_PER_BOARD) {
      return json({ error: `That board already has ${MAX_KEYS_PER_BOARD} keys.` }, { status: 409 });
    }

    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : 'Unlabelled';
    const role: Role = body.role === 'editor' ? 'editor' : 'viewer';

    const supplied = typeof body.password === 'string' ? body.password.trim() : '';
    const password = supplied || generatePassphrase();
    if (password.length < KEY_MIN_LENGTH) {
      return json(
        { error: `A password needs at least ${KEY_MIN_LENGTH} characters.` },
        { status: 400 },
      );
    }
    // The master password must stay the one thing that opens every board, so
    // this one refusal is absolute.
    if (safeEqual(password, masterPassword())) {
      return json({ error: 'That is the master password. Choose another.' }, { status: 409 });
    }
    // Words the site keeps for its own boards, so that "the demo password is
    // welcome" can never lead somebody onto a stranger's board.
    if (supplied && !session.master && isReserved(password)) {
      return json(
        { error: 'That word is kept for this site’s own boards. Choose another.' },
        { status: 409 },
      );
    }

    // Strength is advice here, not a wall. A password opens exactly one board,
    // so a weak one risks only that board, and a board meant to be passed
    // around freely may quite reasonably want its own name as the password.
    // What the owner may not do is choose it without being told.
    if (supplied) {
      const bits = estimateBits(password);
      if (bits < KEY_MIN_BITS && body.acknowledgeWeak !== true) {
        return json(
          {
            error:
              role === 'editor'
                ? 'That password is easy to guess, and this key can change the board. Confirm you want it anyway.'
                : 'That password is easy to guess. Confirm you want it anyway.',
            bits,
            weak: true,
          },
          { status: 400 },
        );
      }
    }

    try {
      return json(await createKey({ boardId, label, role, password }), { status: 201 });
    } catch (error) {
      return json({ error: (error as Error).message }, { status: 409 });
    }
  }

  if (req.method === 'DELETE') {
    if (!id) return notFound();
    const key = await keyById(id);
    if (!key) return notFound();
    if (!scopeFor(key.boardId)) return forbidden();
    // Revoking the key you are holding would lock you out mid-action, with no
    // way back unless you had written it down.
    if (!session.master && key.id === session.keyId) {
      return json(
        { error: 'That is the key you are using. Another key has to revoke it.' },
        { status: 409 },
      );
    }
    return (await revokeKey(id)) ? json({ deleted: true }) : notFound();
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/keys', '/api/keys/:id'] };
