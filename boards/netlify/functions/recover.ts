import type { Config } from '@netlify/functions';
import { json } from './_lib/auth';
import { allowAttempt, boardsForEmail, listKeys, loadBoard } from './_lib/store';
import { sendRecovery } from './_lib/email';

/**
 * Emails back the passphrases for boards registered to an address.
 *
 * Two rules make this safe to leave open. The reply never changes: whether or
 * not the address is known, the caller is told the same thing, so this cannot
 * be used to find out who has a board here. And the passphrases go only to the
 * address itself, never into the response.
 */

const PER_IP_LIMIT = 5;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;

const SAME_ANSWER = {
  ok: true,
  message: 'If that address has a board here, its passphrase is on its way.',
};

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 });

  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (!(await allowAttempt(`recover:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW_MS))) {
    return json({ error: 'Too many attempts. Try again in a little while.' }, { status: 429 });
  }

  let email = '';
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email === 'string') email = body.email.trim().toLowerCase();
  } catch {
    return json({ error: 'bad request' }, { status: 400 });
  }
  if (!email) return json({ error: 'An email address is required.' }, { status: 400 });

  const boardIds = await boardsForEmail(email);
  if (boardIds.length === 0) return json(SAME_ANSWER);

  const entries: { title: string; passphrase: string }[] = [];
  for (const id of boardIds) {
    const board = await loadBoard(id);
    if (!board) continue;
    const keys = await listKeys(id);
    // Only the owner's own way back in, never anyone else's viewing key.
    const owner = keys.find((k) => k.role === 'editor' && k.secret);
    if (owner?.secret) entries.push({ title: board.title, passphrase: owner.secret });
  }

  if (entries.length > 0) await sendRecovery(email, entries);
  return json(SAME_ANSWER);
};

export const config: Config = { path: '/api/recover' };
