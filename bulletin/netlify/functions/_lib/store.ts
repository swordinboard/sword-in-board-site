import { getStore } from '@netlify/blobs';
import { createHash, randomUUID } from 'node:crypto';
import { BOARD_DEFAULTS, type BoardState, type Submission } from '../../../shared/types';

/** Board layout: a single JSON document describing every item on the cork. */
export const boardStore = () => getStore('board');
/** Binary media, keyed by an unguessable id, served only behind the gate. */
export const mediaStore = () => getStore('media');
/** Incoming submissions awaiting review. */
export const submissionStore = () => getStore('submissions');
/** Short-lived login attempt counters. */
export const throttleStore = () => getStore('throttle');

const BOARD_KEY = 'state';

export function emptyBoard(): BoardState {
  return {
    version: 1,
    width: BOARD_DEFAULTS.width,
    height: BOARD_DEFAULTS.height,
    title: process.env.BOARD_TITLE || BOARD_DEFAULTS.title,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadBoard(): Promise<BoardState> {
  const raw = (await boardStore().get(BOARD_KEY, { type: 'json' })) as BoardState | null;
  if (!raw || raw.version !== 1 || !Array.isArray(raw.items)) return emptyBoard();
  return raw;
}

export async function saveBoard(state: BoardState): Promise<BoardState> {
  const next: BoardState = { ...state, version: 1, updatedAt: new Date().toISOString() };
  await boardStore().setJSON(BOARD_KEY, next);
  return next;
}

export const newId = () => randomUUID().replace(/-/g, '');

export async function listSubmissions(): Promise<Submission[]> {
  const { blobs } = await submissionStore().list();
  const loaded = await Promise.all(
    blobs.map((b) => submissionStore().get(b.key, { type: 'json' }) as Promise<Submission | null>),
  );
  return loaded
    .filter((s): s is Submission => Boolean(s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Counts attempts against a coarse fingerprint of the caller within a fixed
 * window. Returns false once the window's allowance is spent.
 */
export async function allowAttempt(fingerprint: string, limit: number, windowMs: number) {
  const key = createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
  const store = throttleStore();
  const now = Date.now();
  const record = (await store.get(key, { type: 'json' })) as
    | { count: number; start: number }
    | null;
  if (!record || now - record.start > windowMs) {
    await store.setJSON(key, { count: 1, start: now });
    return true;
  }
  if (record.count >= limit) return false;
  await store.setJSON(key, { count: record.count + 1, start: record.start });
  return true;
}
