import type { Config } from '@netlify/functions';
import { boardTtlDays, deleteBoard, expiredBoards } from './_lib/store';

/**
 * Clears boards nobody has looked at or changed for the site's limit.
 *
 * Viewing counts as touching, so only genuinely abandoned boards reach this.
 * There is no warning email because there is usually no address to send one
 * to — which is why the expiry date is shown on the board itself instead, and
 * why the limit is generous.
 *
 * Runs on Netlify's scheduler; no extra hosting.
 */
export default async (): Promise<Response> => {
  const doomed = await expiredBoards();
  for (const board of doomed) {
    await deleteBoard(board.id);
    console.log(`[sweep] cleared "${board.title}" (${board.id}), untouched past ${boardTtlDays()} days`);
  }
  if (doomed.length === 0) console.log('[sweep] nothing to clear');
  return new Response(null, { status: 204 });
};

export const config: Config = { schedule: '@daily' };
