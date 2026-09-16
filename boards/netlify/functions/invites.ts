import type { Config, Context } from '@netlify/functions';
import { forbidden, json, notFound, sessionFor, unauthorized } from './_lib/auth';
import { createInvite, listInvites, revokeInvite } from './_lib/store';
import { generatePassphrase } from './_lib/secrets';

const MAX_INVITES = 100;

/**
 * Invite codes, master editor only. Each one lets somebody put up a board while
 * signups are invite-only. A code is not a password: it is spent at creation
 * and opens nothing afterwards.
 */
export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  if (!session.master) return forbidden();

  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'GET') {
    return json({ invites: await listInvites() });
  }

  if (req.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad request' }, { status: 400 });
    }

    if ((await listInvites()).length >= MAX_INVITES) {
      return json({ error: `That is the limit of ${MAX_INVITES} codes.` }, { status: 409 });
    }

    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : 'Unlabelled';
    const rawUses = Number(body.maxUses);
    // Zero means unlimited, which is the right shape for a code posted publicly.
    const maxUses = Number.isFinite(rawUses) && rawUses >= 0 ? Math.min(Math.floor(rawUses), 999) : 1;
    const code =
      typeof body.code === 'string' && body.code.trim().length >= 6
        ? body.code.trim().slice(0, 80)
        : generatePassphrase();

    try {
      return json(await createInvite({ label, code, maxUses }), { status: 201 });
    } catch (error) {
      return json({ error: (error as Error).message }, { status: 409 });
    }
  }

  if (req.method === 'DELETE') {
    if (!id) return notFound();
    return (await revokeInvite(id)) ? json({ deleted: true }) : notFound();
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/invites', '/api/invites/:id'] };
