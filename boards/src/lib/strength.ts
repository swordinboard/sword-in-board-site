import { KEY_MIN_BITS } from '../../shared/types';

/**
 * A browser-side echo of the server's password check, so a weak choice is
 * obvious before the form is sent. The server decides; this only warns.
 *
 * Deliberately simpler than the server's version — it has no word list to hand
 * — so it errs toward calling things weak rather than strong.
 */
const COMMON =
  `password passwd secret letmein welcome admin login user guest qwerty asdf zxcvbn
   dragon monkey master shadow sunshine princess football baseball superman batman
   iloveyou trustno hello test temp changeme default root abc abcd access money
   freedom whatever qazwsx starwars summer winter spring autumn chocolate cookie
   pepper google apple facebook internet computer bulletin board corkboard`
    .split(/\s+/)
    .filter(Boolean);

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i',
};

const bare = (value: string) =>
  value.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, '');

const isRun = (value: string) => {
  if (value.length < 4) return false;
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghijklmnopqrstuvwxyz', '0123456789'];
  const f = value.toLowerCase();
  const b = [...f].reverse().join('');
  return rows.some((row) => row.includes(f) || row.includes(b));
};

export interface Strength {
  bits: number;
  ok: boolean;
  label: string;
}

export function strengthOf(password: string, forbidden: string[] = []): Strength {
  const value = password.trim();
  if (!value) return { bits: 0, ok: false, label: '' };

  const flat = bare(value);
  let bits: number;

  if (new Set(value).size <= 2) bits = 0;
  else if (COMMON.includes(flat)) bits = 4;
  else if (isRun(value.replace(/[^a-zA-Z0-9]/g, ''))) bits = 4;
  else if (forbidden.some((word) => bare(word).length >= 4 && flat.includes(bare(word)))) bits = 6;
  else {
    const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const parts = tokens.length > 1 ? tokens : [value.toLowerCase()];
    bits = 0;
    for (const token of parts) {
      if (/^\d+$/.test(token)) bits += Math.log2(Math.max(10 ** Math.min(token.length, 4), 10));
      else if (COMMON.includes(bare(token)) || isRun(token)) bits += 5;
      else {
        let charset = 0;
        if (/[a-z]/.test(token)) charset += 26;
        if (/[A-Z]/.test(value)) charset += 26;
        if (/[0-9]/.test(token)) charset += 10;
        if (/[^a-z0-9]/i.test(token)) charset += 33;
        // Matches the server's cost for one recognisable word. Erring slightly
        // strict keeps the button from enabling on something the server will
        // then refuse.
        bits += Math.min(
          token.length * Math.log2(Math.max(charset, 2)),
          12 + Math.max(0, token.length - 8) * 2,
        );
      }
    }
    if (parts.length > 1) bits += Math.log2(parts.length);
  }

  bits = Math.round(bits);
  const ok = bits >= KEY_MIN_BITS;
  const label = !ok
    ? bits < 20
      ? 'Too easy to guess'
      : 'Still a bit guessable'
    : bits < 50
      ? 'Good'
      : 'Very strong';
  return { bits, ok, label };
}
