import type { Config, Context } from '@netlify/functions';
import { boardIdFor, forbidden, json, notFound, sessionFor, unauthorized } from './_lib/auth';
import {
  allowAttempt,
  deleteReport,
  listReports,
  loadBoard,
  newId,
  reportStore,
  saveReport,
} from './_lib/store';
import { notifyReport } from './_lib/email';
import {
  REPORT_REASONS,
  type Report,
  type ReportReason,
  type ReportStatus,
} from '../../shared/types';

/**
 * Reporting a board for content that may be against the law.
 *
 * Anyone holding a password to a board can report that board, and only that
 * board — there is nothing else they can see. Reports are deliberately narrow:
 * the site does not arbitrate taste, it just declines to host crime.
 */

const PER_IP_LIMIT = 10;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const STATUSES: ReportStatus[] = ['open', 'actioned', 'dismissed'];

export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'POST') {
    const ip = req.headers.get('x-nf-client-connection-ip') ?? 'unknown';
    if (!(await allowAttempt(`report:${ip}`, PER_IP_LIMIT, PER_IP_WINDOW_MS))) {
      return json({ error: 'That is a lot of reports at once. Try again later.' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }

    // Always the board the reporter is actually looking at, never one they name.
    const boardId = await boardIdFor(req, session);
    const board = await loadBoard(boardId);
    if (!board) return notFound();

    const reason = REPORT_REASONS.some((r) => r.value === body.reason)
      ? (body.reason as ReportReason)
      : null;
    if (!reason) return json({ error: 'Choose what is wrong with it.' }, { status: 400 });

    const detail = typeof body.detail === 'string' ? body.detail.trim().slice(0, 2000) : '';
    if (reason === 'other-illegal' && !detail) {
      return json({ error: 'Say what it is, so it can be looked at.' }, { status: 400 });
    }

    const report: Report = {
      id: newId(),
      boardId,
      boardTitle: board.title,
      reason,
      detail,
      createdAt: new Date().toISOString(),
      status: 'open',
      keyId: session.keyId,
    };
    await saveReport(report);

    await notifyReport({
      boardTitle: board.title,
      boardId,
      reason: REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason,
      detail,
      reviewUrl: `${new URL(req.url).origin}/?board=${boardId}`,
    });

    return json({ ok: true }, { status: 201 });
  }

  // Everything below is the site owner's side of it.
  if (!session.master) return forbidden();

  if (req.method === 'GET') {
    return json({ reports: await listReports() });
  }

  if (req.method === 'PATCH') {
    if (!id) return notFound();
    const existing = (await reportStore().get(id, { type: 'json' })) as Report | null;
    if (!existing) return notFound();
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }
    const status = STATUSES.includes(body.status as ReportStatus)
      ? (body.status as ReportStatus)
      : existing.status;
    const next: Report = { ...existing, status };
    await saveReport(next);
    return json(next);
  }

  if (req.method === 'DELETE') {
    if (!id) return notFound();
    await deleteReport(id);
    return json({ deleted: true });
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/report', '/api/report/:id'] };
