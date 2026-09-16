import { WORDS } from './wordlist';

/**
 * A passphrase that survives being read aloud down a phone line: three words
 * and a four-digit number, roughly 42 bits. The word list size is what carries
 * this - the same shape drawn from a thirty-word list is barely a PIN.
 *
 * The randomness comes in rather than being reached for, because the two
 * callers have different sources: node's randomBytes on the server, the web
 * crypto the browser gives when somebody is cycling through suggestions in the
 * keys dialog. Both must produce the same shape, or the note under the field
 * would be describing a passphrase nobody is actually being offered.
 *
 * `below` must be uniform over [0, bound). A modulo of a random integer is not,
 * and would quietly bias the low end of the word list.
 */
export function makePassphrase(below: (bound: number) => number): string {
  const picks: string[] = [];
  while (picks.length < 3) {
    const word = WORDS[below(WORDS.length)];
    if (!picks.includes(word)) picks.push(word);
  }
  return `${picks.join('-')}-${1000 + below(9000)}`;
}

/** Entropy of a passphrase this generator produced, for documentation and tests. */
export const GENERATED_BITS = Math.log2(
  WORDS.length * (WORDS.length - 1) * (WORDS.length - 2) * 9000,
);
