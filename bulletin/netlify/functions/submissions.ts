import type { Config, Context } from '@netlify/functions';
import { forbidden, json, roleFor, unauthorized } from './_lib/auth';
import {
  allowAttempt,
  listSubmissions,
  loadBoard,
  mediaStore,
  newId,
  submissionStore,
} from './_lib/store';
import { notifySubmission } from './_lib/email';
import type { Submission, SubmissionStatus } from '../../shared/types';

const STATUSES: SubmissionStatus[] = ['new', 'reviewed', 'placed', 'archived'];
const SUBMIT_LIMIT = 12;
const SUBMIT_WINDOW_MS = 60 * 60 * 1000;

export default async (req: Request, context: Context): Promise<Response> => {
  const role = roleFor(req);
  if (!role) return unauthorized();

  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'GET') {
    if (role !== 'editor') return forbidden();
    return json({ submissions: await listSubmissions() });
  }

  if (req.method === 'POST') {
    const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
    if (!(await allowAttempt(`submit:${ip}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS))) {
      return json({ error: 'That is a lot of submissions at once. Try again later.' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 4000) : '';
    const submitter =
      typeof body.submitter === 'string' && body.submitter.trim()
        ? body.submitter.trim().slice(0, 120)
        : 'Anonymous';
    const contact =
      typeof body.contact === 'string' && body.contact.trim()
        ? body.contact.trim().slice(0, 200)
        : undefined;
    const mediaIds = Array.isArray(body.mediaIds)
      ? body.mediaIds
          .filter((value): value is string => typeof value === 'string')
          .slice(0, 8)
          .map((value) => value.slice(0, 64))
      : [];

    if (!note && mediaIds.length === 0) {
      return json({ error: 'Add a note or at least one image.' }, { status: 400 });
    }

    const submission: Submission = {
      id: newId(),
      createdAt: new Date().toISOString(),
      submitter,
      contact,
      note,
      mediaIds,
      status: 'new',
    };
    await submissionStore().setJSON(submission.id, submission);

    const origin = new URL(req.url).origin;
    await notifySubmission({
      submitter,
      contact,
      note,
      mediaCount: mediaIds.length,
      reviewUrl: `${origin}/?review=${submission.id}`,
    });

    return json({ ok: true, id: submission.id }, { status: 201 });
  }

  if (req.method === 'PATCH') {
    if (role !== 'editor') return forbidden();
    if (!id) return json({ error: 'not found' }, { status: 404 });
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    const existing = (await submissionStore().get(id, { type: 'json' })) as Submission | null;
    if (!existing) return json({ error: 'not found' }, { status: 404 });
    const status = STATUSES.includes(body.status as SubmissionStatus)
      ? (body.status as SubmissionStatus)
      : existing.status;
    const next: Submission = { ...existing, status };
    await submissionStore().setJSON(id, next);
    return json(next);
  }

  if (req.method === 'DELETE') {
    if (role !== 'editor') return forbidden();
    if (!id) return json({ error: 'not found' }, { status: 404 });
    const existing = (await submissionStore().get(id, { type: 'json' })) as Submission | null;
    if (existing && existing.mediaIds.length > 0) {
      // Media that was never placed on the board goes with the submission;
      // anything already hanging on the cork stays.
      const board = await loadBoard();
      const inUse = new Set(board.items.map((item) => item.mediaId).filter(Boolean));
      const orphans = existing.mediaIds.filter((mediaId) => !inUse.has(mediaId));
      await Promise.all(orphans.map((mediaId) => mediaStore().delete(mediaId)));
    }
    await submissionStore().delete(id);
    return json({ deleted: true });
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/submissions', '/api/submissions/:id'] };
