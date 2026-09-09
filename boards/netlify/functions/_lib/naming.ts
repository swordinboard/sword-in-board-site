import { RESERVED_TITLES, SITE_DEFAULT_NAME } from '../../../shared/types';

/**
 * Guards against a board dressed up as the site itself.
 *
 * A title is only a label — nothing routes by it and two boards may share one —
 * so this is not about ownership of a name. It is about the one impersonation
 * that could actually mislead somebody: a board that appears to speak for
 * Borough Boards rather than for a person.
 *
 * The master editor is exempt, since the site's own boards are precisely the
 * ones that should carry the site's name.
 */

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's',
};

/** Strips a title down to the letters somebody would actually read. */
function flatten(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[0134578@$]/g, (ch) => LEET[ch] ?? ch)
    .replace(/[^a-z0-9]/g, '');
}

export function siteName(): string {
  return process.env.SITE_NAME || SITE_DEFAULT_NAME;
}

/** A reason the title cannot be used, or null when it is fine. */
export function titleObjection(title: string): string | null {
  const flat = flatten(title);
  if (!flat) return 'Give the board a name.';

  if (flat.includes(flatten(siteName()))) {
    return `A board cannot be named after the site itself. Pick a name of your own.`;
  }
  if (RESERVED_TITLES.includes(flat)) {
    return 'That name would look like it speaks for the site. Pick another.';
  }
  return null;
}
