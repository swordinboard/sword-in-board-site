import type { Config, Context } from '@netlify/functions';
import { forbidden, json, masterPassword, notFound, safeEqual, sessionFor, unauthorized } from './_lib/auth';
import { createKey, listKeys, loadBoard, revokeKey } from './_lib/store';
import { estimateBits, generatePassphrase } from './_lib/secrets';
import { KEY_MIN_BITS, KEY_MIN_LENGTH, type Role } from '../../shared/types';

const MAX_KEYS_PER_BOARD = 40;

/**
 * Access keys, master editor only. Each key is a password that opens exactly
 * one board at one role, and can be revoked on its own without disturbing the
 * other people holding keys to the same board.
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  if (!session.master) return forbidden();

  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'GET') {
    const boardId = new URL(req.url).searchParams.get('board') ?? undefined;
    return json({ keys: await listKeys(boardId) });
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }

    const boardId = typeof body.boardId === 'string' ? body.boardId : '';
    const board = await loadBoard(boardId);
    if (!boardId || !board) return notFound();

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
    // The master password must stay the one thing that opens every board.
    // Checked before strength, so reusing it gets the accurate reason rather
    // than a confusing complaint about guessability.
    if (safeEqual(password, masterPassword())) {
      return json({ error: 'That is the master password. Choose another.' }, { status: 409 });
    }
    // Length alone would wave through "abc12345". Weigh how guessable it is,
    // and refuse anything built from this board's own name. The key's label is
    // deliberately not forbidden: it is private to the master editor, so it
    // gives a guesser nothing, and barring it would reject a sound password
    // merely for containing the holder's name.
    if (supplied) {
      const bits = estimateBits(password, [board.title]);
      if (bits < KEY_MIN_BITS) {
        return json(
          {
            error:
              'That password would be guessed too easily. Try three unrelated words, ' +
              'or leave the field blank for a generated one.',
            bits,
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
    return (await revokeKey(id)) ? json({ deleted: true }) : notFound();
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/keys', '/api/keys/:id'] };
