import { getStore } from '@netlify/blobs';
import { createHash, randomUUID } from 'node:crypto';
import {
  BOARD_DEFAULTS,
  type AccessKey,
  type BoardState,
  type Role,
  type Submission,
} from '../../../shared/types';
import { decryptSecret, encryptSecret, lookupIndex } from './secrets';

/** One document per board, keyed by board id. */
export const boardStore = () => getStore('board');
/** Binary media. Each blob records the board it belongs to in its metadata. */
export const mediaStore = () => getStore('media');
/** Incoming submissions awaiting review. */
export const submissionStore = () => getStore('submissions');
/** Short-lived login attempt counters. */
export const throttleStore = () => getStore('throttle');
/** Access keys, by their own random id. */
export const keyStore = () => getStore('keys');
/** Password index -> key id, so a login is one read rather than a scan. */
export const keyIndexStore = () => getStore('key-index');

/** The key the original single-board release wrote to. */
const LEGACY_KEY = 'state';

export const newId = () => randomUUID().replace(/-/g, '');

/* ---------------------------------------------------------------- boards */

export function emptyBoard(id: string, title?: string): BoardState {
  return {
    version: 1,
    id,
    width: BOARD_DEFAULTS.width,
    height: BOARD_DEFAULTS.height,
    title: title || process.env.BOARD_TITLE || BOARD_DEFAULTS.title,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

const isBoard = (raw: unknown): raw is BoardState =>
  Boolean(raw) &&
  typeof raw === 'object' &&
  (raw as BoardState).version === 1 &&
  Array.isArray((raw as BoardState).items);

export async function loadBoard(id: string): Promise<BoardState | null> {
  const raw = await boardStore().get(id, { type: 'json' });
  if (!isBoard(raw)) return null;
  return { ...raw, id };
}

export async function saveBoard(state: BoardState): Promise<BoardState> {
  const next: BoardState = { ...state, version: 1, updatedAt: new Date().toISOString() };
  await boardStore().setJSON(next.id, next);
  return next;
}

export async function listBoards(): Promise<BoardState[]> {
  const { blobs } = await boardStore().list();
  const loaded = await Promise.all(
    blobs
      .filter((blob) => blob.key !== LEGACY_KEY)
      .map(async (blob) => loadBoard(blob.key)),
  );
  return loaded
    .filter((board): board is BoardState => board !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Makes sure at least one board exists, carrying the original single-board
 * document across the first time this runs. Returns the fallback board that
 * the master editor lands on.
 */
export async function ensureBoard(): Promise<BoardState> {
  const existing = await listBoards();
  if (existing.length > 0) return existing[0];

  const legacy = await boardStore().get(LEGACY_KEY, { type: 'json' });
  const id = newId();
  const migrated: BoardState = isBoard(legacy)
    ? { ...legacy, id }
    : emptyBoard(id);
  await saveBoard(migrated);
  if (isBoard(legacy)) await boardStore().delete(LEGACY_KEY);
  return migrated;
}

/**
 * Every blob filed against a board, whether or not anything points at it any
 * more. Uploads that were abandoned half way through the add flow are only
 * reachable this way.
 */
export async function mediaForBoard(boardId: string): Promise<string[]> {
  const store = mediaStore();
  const { blobs } = await store.list();
  const owners = await Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key,
      boardId: (await store.getMetadata(blob.key))?.metadata?.boardId,
    })),
  );
  return owners.filter((entry) => entry.boardId === boardId).map((entry) => entry.key);
}

export async function deleteBoard(id: string): Promise<void> {
  const [subs, keys, media] = await Promise.all([
    listSubmissions(id),
    listKeys(id),
    mediaForBoard(id),
  ]);

  await Promise.all([
    ...media.map((mediaId) => mediaStore().delete(mediaId)),
    ...subs.map((sub) => submissionStore().delete(sub.id)),
    ...keys.map((key) => revokeKey(key.id)),
    boardStore().delete(id),
  ]);
}

/* ------------------------------------------------------------------ keys */

interface StoredKey {
  id: string;
  boardId: string;
  label: string;
  role: Role;
  createdAt: string;
  lastUsedAt?: string;
  /** The password, encrypted, so the master editor can read it back. */
  sealed: string;
  index: string;
}

export async function createKey(input: {
  boardId: string;
  label: string;
  role: Role;
  password: string;
}): Promise<AccessKey> {
  const index = await lookupIndex(input.password);
  const clash = await keyIndexStore().get(index, { type: 'text' });
  if (clash) throw new Error('That password already opens a board. Choose another.');

  const stored: StoredKey = {
    id: newId(),
    boardId: input.boardId,
    label: input.label,
    role: input.role,
    createdAt: new Date().toISOString(),
    sealed: await encryptSecret(input.password),
    index,
  };
  await keyStore().setJSON(stored.id, stored);
  await keyIndexStore().set(index, stored.id);
  return {
    id: stored.id,
    boardId: stored.boardId,
    label: stored.label,
    role: stored.role,
    createdAt: stored.createdAt,
    secret: input.password,
  };
}

export async function keyById(id: string): Promise<StoredKey | null> {
  return (await keyStore().get(id, { type: 'json' })) as StoredKey | null;
}

/** Resolves a submitted password to the key it belongs to, or null. */
export async function keyForPassword(password: string): Promise<StoredKey | null> {
  const index = await lookupIndex(password);
  const id = (await keyIndexStore().get(index, { type: 'text' })) as string | null;
  if (!id) return null;
  return keyById(id);
}

export async function touchKey(key: StoredKey): Promise<void> {
  await keyStore().setJSON(key.id, { ...key, lastUsedAt: new Date().toISOString() });
}

export async function listKeys(boardId?: string): Promise<AccessKey[]> {
  const { blobs } = await keyStore().list();
  const loaded = await Promise.all(blobs.map((blob) => keyById(blob.key)));
  const keys = loaded.filter((key): key is StoredKey => key !== null);
  const scoped = boardId ? keys.filter((key) => key.boardId === boardId) : keys;
  return Promise.all(
    scoped
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(async (key) => ({
        id: key.id,
        boardId: key.boardId,
        label: key.label,
        role: key.role,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        secret: (await decryptSecret(key.sealed)) ?? undefined,
      })),
  );
}

export async function revokeKey(id: string): Promise<boolean> {
  const key = await keyById(id);
  if (!key) return false;
  await Promise.all([keyIndexStore().delete(key.index), keyStore().delete(id)]);
  return true;
}

export async function countKeys(boardId: string): Promise<number> {
  const keys = await listKeys(boardId);
  return keys.length;
}

/* ----------------------------------------------------------- submissions */

export async function listSubmissions(boardId?: string): Promise<Submission[]> {
  const { blobs } = await submissionStore().list();
  const loaded = await Promise.all(
    blobs.map((b) => submissionStore().get(b.key, { type: 'json' }) as Promise<Submission | null>),
  );
  return loaded
    .filter((s): s is Submission => Boolean(s))
    .filter((s) => !boardId || s.boardId === boardId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------- throttle */

const throttleKey = (fingerprint: string) =>
  createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);

/** Forgets a caller's failed attempts, once they prove they belong here. */
export async function clearAttempts(fingerprint: string): Promise<void> {
  await throttleStore().delete(throttleKey(fingerprint));
}

/**
 * Counts attempts against a coarse fingerprint of the caller within a fixed
 * window. Returns false once the window's allowance is spent.
 *
 * Blobs offer no atomic increment, so two simultaneous requests can each read
 * the same count and let one extra attempt through. At these limits that is
 * noise, and the site-wide ceiling in guard.ts is the real bound.
 */
export async function allowAttempt(fingerprint: string, limit: number, windowMs: number) {
  const key = throttleKey(fingerprint);
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
