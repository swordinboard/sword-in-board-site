import { createHmac, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import type { Role } from '../../../shared/types';

const COOKIE = 'bb_session';
/** Six months. The cookie is the "stays logged in" mechanism the board relies on. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface EnvConfig {
  viewerPassword: string;
  editorPassword: string;
  key: string;
}

/**
 * Reads the passwords from the environment. The signing key defaults to a
 * digest of both passwords, so rotating either one invalidates every cookie
 * issued before the change. Set AUTH_SECRET to rotate keys and passwords
 * independently.
 */
export function readEnv(): EnvConfig | null {
  const viewerPassword = process.env.BOARD_PASSWORD ?? '';
  const editorPassword = process.env.EDITOR_PASSWORD ?? '';
  if (!viewerPassword || !editorPassword) return null;
  const explicit = process.env.AUTH_SECRET ?? '';
  const key = createHash('sha256')
    .update(`${explicit} ${viewerPassword} ${editorPassword}`)
    .digest('hex');
  return { viewerPassword, editorPassword, key };
}

function sign(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('base64url');
}

/** Compares two secrets without leaking their contents through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function issueToken(role: Role, key: string): string {
  const body = Buffer.from(
    JSON.stringify({ r: role, i: Date.now(), n: randomUUID() }),
  ).toString('base64url');
  return `${body}.${sign(body, key)}`;
}

export function verifyToken(token: string, key: string): Role | null {
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body, key);
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      r?: string;
      i?: number;
    };
    if (typeof parsed.i !== 'number' || Date.now() - parsed.i > MAX_AGE_SECONDS * 1000) return null;
    if (parsed.r !== 'viewer' && parsed.r !== 'editor') return null;
    return parsed.r;
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

/** Returns the role carried by the request's cookie, or null when unauthenticated. */
export function roleFor(req: Request): Role | null {
  const env = readEnv();
  if (!env) return null;
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  return verifyToken(token, env.key);
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
}

export const unauthorized = () => json({ error: 'unauthorized' }, { status: 401 });
export const forbidden = () => json({ error: 'forbidden' }, { status: 403 });
export const misconfigured = () =>
  json(
    { error: 'This board is not configured yet: BOARD_PASSWORD and EDITOR_PASSWORD are unset.' },
    { status: 503 },
  );
