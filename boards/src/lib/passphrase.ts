import { makePassphrase } from '../../shared/passphrase';

/**
 * A uniformly random integer below `bound`, from the browser's crypto. Rejection
 * sampling rather than a modulo, which would bias the low end of the word list -
 * the same reasoning, and the same shape, as the server's own generator.
 */
function randomBelow(bound: number): number {
  const limit = Math.floor(0xffffffff / bound) * bound;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % bound;
  }
}

/** One suggestion for the keys dialog. Click again for another. */
export const suggestPassphrase = () => makePassphrase(randomBelow);
