import { throttleStore } from './store';
import { notifyAttack } from './email';

/**
 * Brute-force defence.
 *
 * The shape of the problem: a per-IP limit does nothing against a thousand
 * machines each guessing slowly. What actually bounds a distributed attack is a
 * ceiling on how many *wrong* answers the whole site will entertain in a
 * window, regardless of where they come from.
 *
 * The design rule that keeps this invisible to real people: the ceiling is
 * checked only after the password has been resolved, and only on failure. A
 * correct password is never refused, no matter how hard the site is being
 * attacked. Someone walking up to look at a friend's board types the right
 * thing and is let in; the limiter only ever meets guessers.
 *
 * There is deliberately no artificial delay. Sleeping inside a billed function
 * would let an attacker inflate the hosting bill, which is its own denial of
 * service.
 */

const GLOBAL_KEY = 'global-failures';
const ALERT_KEY = 'attack-alert-sent';

/** Wrong answers the whole site will tolerate before it stops playing along. */
const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;

/** Per-IP allowance. Bounds what a single source can cost as well as guess. */
export const IP_LIMIT = 10;
export const IP_WINDOW_MS = 15 * 60 * 1000;

const ALERT_EVERY_MS = 60 * 60 * 1000;
/** Records older than this are dead weight; prune them opportunistically. */
const STALE_MS = 24 * 60 * 60 * 1000;

interface Window {
  count: number;
  start: number;
}

export interface GuardResult {
  /** Failures seen site-wide in the current window. */
  count: number;
  /** True once the site should stop answering guesses. */
  tripped: boolean;
}

/**
 * Records one failed attempt against the site-wide window and reports whether
 * the ceiling is now spent.
 */
export async function noteFailure(origin: string): Promise<GuardResult> {
  const store = throttleStore();
  const now = Date.now();
  const record = (await store.get(GLOBAL_KEY, { type: 'json' })) as Window | null;

  const next: Window =
    !record || now - record.start > GLOBAL_WINDOW_MS
      ? { count: 1, start: now }
      : { count: record.count + 1, start: record.start };
  await store.setJSON(GLOBAL_KEY, next);

  const tripped = next.count > GLOBAL_LIMIT;
  if (tripped) await maybeAlert(next.count, origin);
  void prune();
  return { count: next.count, tripped };
}

/** Whether the site is currently refusing guesses, without recording one. */
export async function underAttack(): Promise<boolean> {
  const record = (await throttleStore().get(GLOBAL_KEY, { type: 'json' })) as Window | null;
  if (!record) return false;
  if (Date.now() - record.start > GLOBAL_WINDOW_MS) return false;
  return record.count > GLOBAL_LIMIT;
}

/** One mail an hour at most, so the alert cannot become the flood. */
async function maybeAlert(count: number, origin: string): Promise<void> {
  const store = throttleStore();
  const last = (await store.get(ALERT_KEY, { type: 'json' })) as { at: number } | null;
  const now = Date.now();
  if (last && now - last.at < ALERT_EVERY_MS) return;
  await store.setJSON(ALERT_KEY, { at: now });
  await notifyAttack({ failures: count, windowMinutes: GLOBAL_WINDOW_MS / 60000, origin });
}

/**
 * Netlify Blobs has no expiry, so old per-IP windows would accumulate forever.
 * Clearing them is not urgent, so it happens on a small fraction of calls.
 */
async function prune(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    const store = throttleStore();
    const { blobs } = await store.list();
    const now = Date.now();
    await Promise.all(
      blobs.map(async (blob) => {
        if (blob.key === GLOBAL_KEY || blob.key === ALERT_KEY) return;
        const record = (await store.get(blob.key, { type: 'json' })) as Window | null;
        if (!record || now - record.start > STALE_MS) await store.delete(blob.key);
      }),
    );
  } catch {
    // Housekeeping only; never let it affect a login.
  }
}

/**
 * Where a challenge goes, if one is ever wanted.
 *
 * To bolt on Cloudflare Turnstile (or hCaptcha) later, without touching
 * anything else:
 *
 *   1. Return `challenge: true` to the client when this says so — the auth
 *      function already does, in its 429 body.
 *   2. Have the login form render the widget when it sees that flag and post
 *      the resulting token alongside the password.
 *   3. Replace the body of this function with a POST to
 *      https://challenges.cloudflare.com/turnstile/v0/siteverify and return
 *      whether the token verified.
 *   4. Add the widget's script host to script-src in netlify.toml's CSP.
 *
 * Nothing else in the flow has to change: a passing challenge simply means the
 * global ceiling is not applied to that attempt, so an attacker pays per guess
 * while a real person clicks nothing.
 */
export async function challengeSatisfied(_req: Request): Promise<boolean> {
  return false;
}
