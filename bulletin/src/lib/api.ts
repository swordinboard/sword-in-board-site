import type { BoardState, Role, SessionInfo, Submission, SubmissionStatus } from '../../shared/types';

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

export const getSession = () => request<SessionInfo>('/api/auth');

export const login = (password: string) =>
  request<SessionInfo>('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });

export const logout = () => request<SessionInfo>('/api/auth', { method: 'DELETE' });

export const getBoard = () => request<BoardState>('/api/board');

export const saveBoard = (state: BoardState) =>
  request<BoardState>('/api/board', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });

export const uploadMedia = (blob: Blob) =>
  request<{ id: string; url: string }>('/api/media', {
    method: 'POST',
    headers: { 'content-type': blob.type },
    body: blob,
  });

export const getSubmissions = () =>
  request<{ submissions: Submission[] }>('/api/submissions').then((r) => r.submissions);

export const createSubmission = (input: {
  submitter: string;
  contact?: string;
  note: string;
  mediaIds: string[];
}) =>
  request<{ ok: true; id: string }>('/api/submissions', {
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

export const mediaUrl = (mediaId: string) => `/api/media/${mediaId}`;

export type { Role };
