import { BOARD_DEFAULTS } from '../../shared/types';

/**
 * The board's name. Set VITE_BOARD_TITLE in the Netlify site's environment to
 * brand an instance; the repository itself stays generic.
 */
export const BOARD_TITLE: string =
  import.meta.env.VITE_BOARD_TITLE?.trim() || BOARD_DEFAULTS.title;
