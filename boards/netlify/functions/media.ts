import type { Config, Context } from '@netlify/functions';
import { boardIdFor, json, notFound, sessionFor, unauthorized } from './_lib/auth';
import { mediaStore, newId } from './_lib/store';

/** Netlify caps a synchronous function request body at 6MB; stay clear of it. */
const MAX_BYTES = 4_500_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default async (req: Request, context: Context): Promise<Response> => {
  const session = await sessionFor(req);
  if (!session) return unauthorized();
  const boardId = await boardIdFor(req, session);

  const id = (context.params as Record<string, string | undefined>)?.id;

  if (req.method === 'GET') {
    if (!id) return notFound();
    const result = await mediaStore().getWithMetadata(id, { type: 'arrayBuffer' });
    if (!result) return notFound();

    // Media is owned by a board. Without this check a key for one board could
    // read another board's images by guessing nothing more than an id.
    const owner = result.metadata?.boardId as string | undefined;
    if (!session.master && owner && owner !== boardId) return notFound();

    const contentType = (result.metadata?.contentType as string) || 'application/octet-stream';
    return new Response(result.data, {
      headers: {
        'content-type': contentType,
        // Private: the id is unguessable and the bytes are gated, so a browser
        // may keep them, but no shared cache may.
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  if (req.method === 'POST') {
    const contentType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.has(contentType)) {
      return json({ error: 'Only JPEG, PNG, WebP, and GIF images are accepted.' }, { status: 415 });
    }
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES) {
      return json({ error: 'That image is too large. Keep it under 4.5MB.' }, { status: 413 });
    }
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength === 0) return json({ error: 'Empty upload.' }, { status: 400 });
    if (bytes.byteLength > MAX_BYTES) {
      return json({ error: 'That image is too large. Keep it under 4.5MB.' }, { status: 413 });
    }

    const mediaId = newId();
    await mediaStore().set(mediaId, bytes, {
      metadata: {
        contentType,
        boardId,
        uploadedAt: new Date().toISOString(),
        role: session.role,
      },
    });
    return json({ id: mediaId, url: `/api/media/${mediaId}` }, { status: 201 });
  }

  if (req.method === 'DELETE') {
    if (session.role !== 'editor') return json({ error: 'forbidden' }, { status: 403 });
    if (!id) return notFound();
    const result = await mediaStore().getWithMetadata(id, { type: 'arrayBuffer' });
    const owner = result?.metadata?.boardId as string | undefined;
    if (!session.master && owner && owner !== boardId) return notFound();
    await mediaStore().delete(id);
    return json({ deleted: true });
  }

  return json({ error: 'method not allowed' }, { status: 405 });
};

export const config: Config = { path: ['/api/media', '/api/media/:id'] };
