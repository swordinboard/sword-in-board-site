import { RESERVED_TITLES, SITE_DEFAULT_NAME } from '../../../shared/types';

/**
 * Guards against a board dressed up as the site itself.
 *
 * A title is only a label — nothing routes by it and two boards may share one —
 * so this is not about ownership of a name. It is about the one impersonation
 * that could actually mislead somebody: a board that appears to speak for
 * Pinhold rather than for a person.
 *
 * The master editor is exempt, since the site's own boards are precisely the
 * ones that should carry the site's name.
 */

/**
 * Glyphs that read as each other, each group collapsed to one symbol.
 *
 * Both sides of every comparison are put through this, rather than expanding
 * digits back into letters. Expanding cannot work: `1` stands for both `i` and
 * `l`, so mapping it to either one lets the other through — `H01d` read as
 * `hoid` sails past a guard looking for `hold`. Collapsing has no such choice
 * to get wrong, since `hold`, `h0ld`, `ho1d` and `h01d` all land on `h01d`.
 */
const HOMOGLYPHS: Record<string, string> = {
  o: '0', '0': '0',
  i: '1', l: '1', '1': '1', '|': '1', '!': '1',
  e: '3', '3': '3',
  a: '4', '4': '4', '@': '4',
  s: '5', '5': '5', $: '5',
  g: '6', '6': '6',
  t: '7', '7': '7',
  b: '8', '8': '8',
};

/** Reduces a name to the shape somebody would actually read it as. */
function canonical(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9|!@$]/g, '')
    .replace(/[a-z0-9|!@$]/g, (ch) => HOMOGLYPHS[ch] ?? ch);
}

export function siteName(): string {
  // Not SITE_NAME: Netlify sets that to the site's own slug, so this guard
  // had been holding back "pinhold-swordinboard" as a board title while
  // leaving the name it is actually meant to protect free for anyone.
  return process.env.PINHOLD_NAME?.trim() || SITE_DEFAULT_NAME;
}

/** A reason the title cannot be used, or null when it is fine. */
export function titleObjection(title: string): string | null {
  const flat = canonical(title);
  if (!flat) return 'Give the board a name.';

  if (flat.includes(canonical(siteName()))) {
    return `A board cannot be named after the site itself. Pick a name of your own.`;
  }
  // Compared canonically too, so a reserved word cannot be smuggled past in
  // the same way the site's name cannot.
  if (RESERVED_TITLES.some((word) => canonical(word) === flat)) {
    return 'That name would look like it speaks for the site. Pick another.';
  }
  return null;
}
