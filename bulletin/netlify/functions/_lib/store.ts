import { getStore } from '@netlify/blobs';
import { createHash, randomUUID } from 'node:crypto';
import {
  BOARD_DEFAULTS,
  type AccessKey,
  type BoardState,
  type Invite,
  type Role,
  type SignupMode,
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
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    createdAt: now,
    lastSeenAt: now,
    width: BOARD_DEFAULTS.width,
    height: BOARD_DEFAULTS.height,
    // Only a fallback: every board made through the app is named by its author.
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
  return (await mediaByBoard([boardId])).get(boardId) ?? [];
}

/**
 * One pass over the media store, grouped by board.
 *
 * Doing this per board would mean re-reading every blob's metadata once per
 * board, which is what turns clearing a handful of boards into thousands of
 * reads and puts a scheduled run over its time limit.
 */
export async function mediaByBoard(boardIds: string[]): Promise<Map<string, string[]>> {
  const wanted = new Set(boardIds);
  const grouped = new Map<string, string[]>();
  if (wanted.size === 0) return grouped;

  const store = mediaStore();
  const { blobs } = await store.list();
  const owners = await Promise.all(
    blobs.map(async (blob) => ({
      key: blob.key,
      boardId: (await store.getMetadata(blob.key))?.metadata?.boardId as string | undefined,
    })),
  );
  for (const entry of owners) {
    if (!entry.boardId || !wanted.has(entry.boardId)) continue;
    const list = grouped.get(entry.boardId);
    if (list) list.push(entry.key);
    else grouped.set(entry.boardId, [entry.key]);
  }
  return grouped;
}

export async function deleteBoard(id: string, knownMedia?: string[]): Promise<void> {
  const [subs, keys, media] = await Promise.all([
    listSubmissions(id),
    listKeys(id),
    knownMedia ? Promise.resolve(knownMedia) : mediaForBoard(id),
  ]);

  await Promise.all([
    ...media.map((mediaId) => mediaStore().delete(mediaId)),
    ...subs.map((sub) => submissionStore().delete(sub.id)),
    ...keys.map((key) => revokeKey(key.id)),
    forgetRecovery(id),
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

/* --------------------------------------------------------------- signups */

/** Invite codes, by their own id. */
export const inviteStore = () => getStore('invites');
/** Code index -> invite id. */
export const inviteIndexStore = () => getStore('invite-index');
/** Per-board secrets never sent to a browser, such as a recovery address. */
export const boardSecretStore = () => getStore('board-secrets');
/** Email index -> the boards that address can recover. */
export const recoveryIndexStore = () => getStore('recovery-index');

export function signupMode(): SignupMode {
  const raw = (process.env.SIGNUP_MODE ?? '').trim().toLowerCase();
  if (raw === 'open' || raw === 'closed') return raw;
  // Anything unset or unrecognised means invite-only, which is the setting
  // that cannot surprise anyone by being more permissive than intended.
  return 'invite';
}

/** Days a board may sit untouched before it is cleared. */
export function boardTtlDays(): number {
  const raw = Number(process.env.BOARD_TTL_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 180;
}

export function expiryOf(board: BoardState): string {
  const seen = board.lastSeenAt ?? board.updatedAt;
  return new Date(new Date(seen).getTime() + boardTtlDays() * 86400_000).toISOString();
}

/**
 * Marks a board as still wanted. Writes are throttled to once an hour so that
 * simply looking at a board does not mean a store write per page load.
 */
export async function touchBoard(id: string): Promise<void> {
  const board = await loadBoard(id);
  if (!board) return;
  const last = board.lastSeenAt ? new Date(board.lastSeenAt).getTime() : 0;
  if (Date.now() - last < 60 * 60 * 1000) return;
  await boardStore().setJSON(id, { ...board, lastSeenAt: new Date().toISOString() });
}

interface StoredInvite {
  id: string;
  label: string;
  sealed: string;
  index: string;
  maxUses: number;
  uses: number;
  createdAt: string;
  lastUsedAt?: string;
}

export async function createInvite(input: {
  label: string;
  code: string;
  maxUses: number;
}): Promise<Invite> {
  const index = await lookupIndex(input.code);
  if (await inviteIndexStore().get(index, { type: 'text' })) {
    throw new Error('That code already exists. Choose another.');
  }
  const stored: StoredInvite = {
    id: newId(),
    label: input.label,
    sealed: await encryptSecret(input.code),
    index,
    maxUses: input.maxUses,
    uses: 0,
    createdAt: new Date().toISOString(),
  };
  await inviteStore().setJSON(stored.id, stored);
  await inviteIndexStore().set(index, stored.id);
  return {
    id: stored.id,
    label: stored.label,
    code: input.code,
    maxUses: stored.maxUses,
    uses: 0,
    createdAt: stored.createdAt,
  };
}

export async function listInvites(): Promise<Invite[]> {
  const { blobs } = await inviteStore().list();
  const loaded = await Promise.all(
    blobs.map((b) => inviteStore().get(b.key, { type: 'json' }) as Promise<StoredInvite | null>),
  );
  return Promise.all(
    loaded
      .filter((i): i is StoredInvite => i !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(async (i) => ({
        id: i.id,
        label: i.label,
        code: (await decryptSecret(i.sealed)) ?? undefined,
        maxUses: i.maxUses,
        uses: i.uses,
        createdAt: i.createdAt,
        lastUsedAt: i.lastUsedAt,
      })),
  );
}

export async function revokeInvite(id: string): Promise<boolean> {
  const invite = (await inviteStore().get(id, { type: 'json' })) as StoredInvite | null;
  if (!invite) return false;
  await Promise.all([inviteIndexStore().delete(invite.index), inviteStore().delete(id)]);
  return true;
}

/** Spends one use of a code, or returns false if it is unknown or exhausted. */
export async function consumeInvite(code: string): Promise<boolean> {
  const index = await lookupIndex(code);
  const id = (await inviteIndexStore().get(index, { type: 'text' })) as string | null;
  if (!id) return false;
  const invite = (await inviteStore().get(id, { type: 'json' })) as StoredInvite | null;
  if (!invite) return false;
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return false;
  await inviteStore().setJSON(id, {
    ...invite,
    uses: invite.uses + 1,
    lastUsedAt: new Date().toISOString(),
  });
  return true;
}

/* -------------------------------------------------------------- recovery */

export async function rememberRecoveryEmail(boardId: string, email: string): Promise<void> {
  const normalised = email.trim().toLowerCase();
  await boardSecretStore().setJSON(boardId, { emailSealed: await encryptSecret(normalised) });
  const index = await lookupIndex(normalised);
  const existing = ((await recoveryIndexStore().get(index, { type: 'json' })) ?? []) as string[];
  if (!existing.includes(boardId)) {
    await recoveryIndexStore().setJSON(index, [...existing, boardId]);
  }
}

/** Board ids an address can recover. Empty for an address we do not hold. */
export async function boardsForEmail(email: string): Promise<string[]> {
  const index = await lookupIndex(email.trim().toLowerCase());
  return ((await recoveryIndexStore().get(index, { type: 'json' })) ?? []) as string[];
}

async function forgetRecovery(boardId: string): Promise<void> {
  const secret = (await boardSecretStore().get(boardId, { type: 'json' })) as
    | { emailSealed?: string }
    | null;
  if (secret?.emailSealed) {
    const email = await decryptSecret(secret.emailSealed);
    if (email) {
      const index = await lookupIndex(email);
      const ids = ((await recoveryIndexStore().get(index, { type: 'json' })) ?? []) as string[];
      const left = ids.filter((id) => id !== boardId);
      if (left.length) await recoveryIndexStore().setJSON(index, left);
      else await recoveryIndexStore().delete(index);
    }
  }
  await boardSecretStore().delete(boardId);
}

/** Boards untouched for longer than the site's limit. */
export async function expiredBoards(): Promise<BoardState[]> {
  const now = Date.now();
  const boards = await listBoards();
  return boards.filter((board) => new Date(expiryOf(board)).getTime() < now);
}
