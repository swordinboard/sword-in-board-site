import { createHmac, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import type { Role } from '../../../shared/types';
import { signingKey } from './secrets';
import { ensureBoard, keyById } from './store';

const COOKIE = 'bb_session';
/** Six months. The cookie is the "stays logged in" mechanism the board relies on. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface Session {
  role: Role;
  /** True for the master editor password held in the environment. */
  master: boolean;
  /** The board this session may touch. Null for the master, who sees all. */
  boardId: string | null;
  /** The access key that opened this session, if it was not the developer. */
  keyId: string | null;
}

/**
 * The developer password: the one that opens every board, as opposed to the
 * editor keys that each open one. EDITOR_PASSWORD is the name it was first
 * given and is still honoured, so an existing deployment keeps working.
 */
export const masterPassword = () =>
  (process.env.DEV_PASSWORD || process.env.EDITOR_PASSWORD)?.trim() ?? '';

/** Compares two secrets without leaking their contents through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

interface TokenBody {
  r: Role;
  m: boolean;
  b: string | null;
  k: string | null;
  i: number;
}

export async function issueToken(payload: Omit<TokenBody, 'i'>): Promise<string> {
  const body = Buffer.from(
    JSON.stringify({ ...payload, i: Date.now(), n: randomUUID() }),
  ).toString('base64url');
  const mac = createHmac('sha256', await signingKey()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

async function verifyToken(token: string): Promise<TokenBody | null> {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac('sha256', await signingKey()).update(body).digest('base64url');
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenBody;
    if (typeof parsed.i !== 'number' || Date.now() - parsed.i > MAX_AGE_SECONDS * 1000) return null;
    if (parsed.r !== 'viewer' && parsed.r !== 'editor') return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Resolves the request's session. A key-backed session is re-checked against
 * the store on every request, so revoking a key locks its holder out at once
 * rather than whenever their cookie happens to expire.
 */
export async function sessionFor(req: Request): Promise<Session | null> {
  if (!masterPassword()) return null;
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const body = await verifyToken(token);
  if (!body) return null;

  if (body.m) return { role: 'editor', master: true, boardId: null, keyId: null };

  if (!body.k || !body.b) return null;
  const key = await keyById(body.k);
  if (!key || key.boardId !== body.b) return null;
  // The key's current role wins, so changing it takes effect without a re-login.
  return { role: key.role, master: false, boardId: key.boardId, keyId: key.id };
}

/**
 * Which board this request acts on. A key-backed session is pinned to its own
 * board and any `board` parameter is ignored; only the master may choose.
 */
export async function boardIdFor(req: Request, session: Session): Promise<string> {
  if (!session.master) return session.boardId as string;
  const requested = new URL(req.url).searchParams.get('board');
  if (requested) return requested;
  return (await ensureBoard()).id;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const unauthorized = () => json({ error: 'unauthorized' }, { status: 401 });
export const forbidden = () => json({ error: 'forbidden' }, { status: 403 });
export const notFound = () => json({ error: 'not found' }, { status: 404 });
export const misconfigured = () =>
  json(
    { error: 'This site is not configured yet: DEV_PASSWORD is unset.' },
    { status: 503 },
  );
