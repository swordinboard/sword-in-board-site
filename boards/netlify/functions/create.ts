import type { Config } from '@netlify/functions';
import { issueToken, json, masterPassword, misconfigured, sessionCookie } from './_lib/auth';
import {
  allowAttempt,
  consumeInvite,
  createKey,
  emptyBoard,
  expiryOf,
  newId,
  rememberRecoveryEmail,
  saveBoard,
  signupMode,
} from './_lib/store';
import { generatePassphrase } from './_lib/secrets';
import { titleObjection } from './_lib/naming';
import type { NewBoardResult } from '../../shared/types';

/**
 * Putting up a new board. This is the only endpoint anyone can reach without a
 * password, so it is the one that has to hold up on its own.
 *
 * Whether it works at all is governed by SIGNUP_MODE: closed refuses outright,
 * invite needs a code, open takes all comers. Unset means invite, because the
 * setting that surprises nobody is the restrictive one.
 */

const PER_IP_LIMIT = 3;
const PER_IP_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, { status: 405 });
  if (!masterPassword()) return misconfigured();

  const mode = signupMode();
  if (mode === 'closed') {
    return json({ error: 'New boards are not being taken at the moment.' }, { status: 403 });
  }

  const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (!(await allowAttempt(`create:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW_MS))) {
    return json({ error: 'That is enough new boards from here for one day.' }, { status: 429 });
  }
  if (!(await allowAttempt('create:global', GLOBAL_LIMIT, GLOBAL_WINDOW_MS))) {
    return json({ error: 'A lot of boards are going up right now. Try again shortly.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'bad request' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  if (!title) return json({ error: 'Give the board a name.' }, { status: 400 });
  // Anyone but the master, which is to say everyone reaching this endpoint.
  const objection = titleObjection(title);
  if (objection) return json({ error: objection }, { status: 409 });

  if (mode === 'invite') {
    const code = typeof body.invite === 'string' ? body.invite.trim() : '';
    if (!code) return json({ error: 'A new board needs an invite code.' }, { status: 400 });
    if (!(await consumeInvite(code))) {
      return json({ error: 'That invite code is not valid, or has been used up.' }, { status: 403 });
    }
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email && !EMAIL.test(email)) {
    return json({ error: 'That does not look like an email address.' }, { status: 400 });
  }

  const board = await saveBoard(emptyBoard(newId(), title));
  const passphrase = generatePassphrase();
  const key = await createKey({
    boardId: board.id,
    label: 'Owner',
    role: 'editor',
    password: passphrase,
  });

  if (email) await rememberRecoveryEmail(board.id, email);

  const result: NewBoardResult = {
    board: { ...board, expiresAt: expiryOf(board) },
    passphrase,
    recoveryEmailSaved: Boolean(email),
  };

  // Sign them straight in, so they land on their board rather than being asked
  // for the passphrase they were handed a second ago.
  const token = await issueToken({ r: 'editor', m: false, b: board.id, k: key.id });
  return json(result, { status: 201, headers: { 'set-cookie': sessionCookie(token) } });
};

export const config: Config = { path: '/api/create' };
