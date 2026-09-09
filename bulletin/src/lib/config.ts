import { BOARD_DEFAULTS } from '../../shared/types';

/**
 * What the app itself is called: the browser tab, the login screen, the name
 * someone says out loud when they pass it on.
 *
 * Boards carry their own titles, chosen by whoever puts them up, so this is
 * only ever the name of the place — never the name of a board.
 *
 * Set VITE_SITE_NAME in the Netlify site's environment. It is baked in at
 * build time, so changing it needs a redeploy. It is a label, not a secret.
 */
export const SITE_NAME: string =
  import.meta.env.VITE_SITE_NAME?.trim() ||
  import.meta.env.VITE_BOARD_TITLE?.trim() ||
  BOARD_DEFAULTS.title;
