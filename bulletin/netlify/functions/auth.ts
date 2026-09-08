import type { Config } from '@netlify/functions';
import {
  clearCookie,
  issueToken,
  json,
  misconfigured,
  readEnv,
  roleFor,
  safeEqual,
  sessionCookie,
} from './_lib/auth';
import { allowAttempt } from './_lib/store';

const ATTEMPT_LIMIT = 10;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export default async (req: Request): Promise<Response> => {
  if (req.method === 'GET') {
    const role = roleFor(req);
    return json({ authenticated: role !== null, role });
  }

  if (req.method === 'DELETE') {
    return json({ authenticated: false, role: null }, { headers: { 'set-cookie': clearCookie() } });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method not allowed' }, { status: 405 });
  }

  const env = readEnv();
  if (!env) return misconfigured();

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

  // Editor is checked first so that an editor password also grants viewing.
  const role = safeEqual(password, env.editorPassword)
    ? 'editor'
    : safeEqual(password, env.viewerPassword)
      ? 'viewer'
      : null;

  if (!role) return json({ error: 'That password does not open this board.' }, { status: 401 });

  return json(
    { authenticated: true, role },
    { headers: { 'set-cookie': sessionCookie(issueToken(role, env.key)) } },
  );
};

export const config: Config = { path: '/api/auth' };
