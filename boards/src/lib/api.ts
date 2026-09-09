import type {
  AccessKey,
  BoardState,
  BoardSummary,
  Invite,
  NewBoardResult,
  SiteInfo,
  Role,
  SessionInfo,
  Submission,
  SubmissionStatus,
} from '../../shared/types';

/**
 * The master editor chooses a board with a query parameter. A key-backed
 * session is pinned to its own board server-side and this is ignored for it.
 */
const scope = (path: string, boardId?: string | null) =>
  boardId ? `${path}${path.includes('?') ? '&' : '?'}board=${encodeURIComponent(boardId)}` : path;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init });
  const text = await res.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return payload as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const getSite = () => request<SiteInfo>('/api/site');

export const getSession = () => request<SessionInfo>('/api/auth');

export const createOwnBoard = (input: { title: string; invite?: string; email?: string }) =>
  request<NewBoardResult>('/api/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

export const recoverByEmail = (email: string) =>
  request<{ ok: true; message: string }>('/api/recover', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });

export const login = (password: string) =>
  request<SessionInfo>('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });

export const logout = () => request<SessionInfo>('/api/auth', { method: 'DELETE' });

export const getBoard = (boardId?: string | null) =>
  request<BoardState>(scope('/api/board', boardId));

export const saveBoard = (state: BoardState, boardId?: string | null) =>
  request<BoardState>(scope('/api/board', boardId), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });

export const uploadMedia = (blob: Blob, boardId?: string | null) =>
  request<{ id: string; url: string }>(scope('/api/media', boardId), {
    method: 'POST',
    headers: { 'content-type': blob.type },
    body: blob,
  });

export const getSubmissions = (boardId?: string | null) =>
  request<{ submissions: Submission[] }>(scope('/api/submissions', boardId)).then(
    (r) => r.submissions,
  );

export const createSubmission = (
  input: {
    submitter: string;
    contact?: string;
    note: string;
    mediaIds: string[];
  },
  boardId?: string | null,
) =>
  request<{ ok: true; id: string }>(scope('/api/submissions', boardId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

export const setSubmissionStatus = (id: string, status: SubmissionStatus) =>
  request<Submission>(`/api/submissions/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });

export const deleteSubmission = (id: string) =>
  request<{ deleted: true }>(`/api/submissions/${id}`, { method: 'DELETE' });

export const mediaUrl = (mediaId: string, boardId?: string | null) =>
  scope(`/api/media/${mediaId}`, boardId);

/* ---------------------------------------------------- boards and keys */

export const getBoards = () =>
  request<{ boards: BoardSummary[] }>('/api/boards').then((r) => r.boards);

export const createBoard = (title: string) =>
  request<BoardState>('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });

export const renameBoard = (id: string, title: string) =>
  request<BoardState>(`/api/boards/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });

export const setBoardOfficial = (id: string, official: boolean) =>
  request<BoardState>(`/api/boards/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ official }),
  });

export const deleteBoard = (id: string) =>
  request<{ deleted: true }>(`/api/boards/${id}`, { method: 'DELETE' });

export const getKeys = (boardId: string) =>
  request<{ keys: AccessKey[] }>(scope('/api/keys', boardId)).then((r) => r.keys);

export const createKey = (input: {
  boardId: string;
  label: string;
  role: Role;
  password?: string;
  /** Go ahead with a password the server considers easy to guess. */
  acknowledgeWeak?: boolean;
}) =>
  request<AccessKey>('/api/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

export const revokeKey = (id: string) =>
  request<{ deleted: true }>(`/api/keys/${id}`, { method: 'DELETE' });

export const getInvites = () =>
  request<{ invites: Invite[] }>('/api/invites').then((r) => r.invites);

export const createInvite = (input: { label: string; maxUses: number; code?: string }) =>
  request<Invite>('/api/invites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

export const revokeInvite = (id: string) =>
  request<{ deleted: true }>(`/api/invites/${id}`, { method: 'DELETE' });

export type { Role };
