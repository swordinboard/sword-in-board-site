import type { Config } from '@netlify/functions';
import { boardTtlDays, deleteBoard, expiredBoards, mediaByBoard } from './_lib/store';

/**
 * Clears boards nobody has looked at or changed for the site's limit.
 *
 * Viewing counts as touching, so only genuinely abandoned boards reach this.
 * There is no warning email because there is usually no address to send one
 * to — which is why the expiry date is shown on the board itself instead, and
 * why the limit is generous.
 *
 * Runs on Netlify's scheduler; no extra hosting. It works in small batches and
 * takes the media store's metadata in a single pass, because a scheduled run
 * has a hard time limit and clearing several boards must not mean re-reading
 * every image's metadata once per board.
 */
const BATCH = 25;

export default async (): Promise<Response> => {
  const doomed = (await expiredBoards()).slice(0, BATCH);
  if (doomed.length === 0) {
    console.log('[sweep] nothing to clear');
    return new Response(null, { status: 204 });
  }

  const media = await mediaByBoard(doomed.map((board) => board.id));
  for (const board of doomed) {
    await deleteBoard(board.id, media.get(board.id) ?? []);
    console.log(`[sweep] cleared "${board.title}" (${board.id}), past ${boardTtlDays()} days`);
  }
  // Anything beyond the batch waits for tomorrow, which is soon enough.
  console.log(`[sweep] cleared ${doomed.length} board(s)`);
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: '@daily' };
