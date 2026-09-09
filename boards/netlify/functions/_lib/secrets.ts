import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
} from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { WORDS } from './wordlist';

/**
 * One long-lived secret underpins three things: signing session cookies,
 * deriving the lookup index for access keys, and encrypting the keys at rest.
 *
 * It deliberately does NOT derive from any password. Passwords change; if the
 * secret moved with them, every access key in the store would stop resolving.
 *
 * Set AUTH_SECRET to keep it in the environment, which is the stronger option:
 * the key material then lives somewhere the blob store does not, so a leak of
 * the store alone reveals nothing. With AUTH_SECRET unset, one is generated on
 * first use and kept in the store beside the data it protects, which is enough
 * to stop casual reading but is not defence against someone holding the store.
 */
const CONFIG_STORE = 'config';
const SECRET_KEY = 'root-secret';

let cached: Buffer | null = null;

export async function rootSecret(): Promise<Buffer> {
  if (cached) return cached;

  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) {
    cached = createHash('sha256').update(fromEnv).digest();
    return cached;
  }

  const store = getStore(CONFIG_STORE);
  const existing = (await store.get(SECRET_KEY, { type: 'text' })) as string | null;
  if (existing) {
    cached = Buffer.from(existing, 'hex');
    return cached;
  }

  const generated = randomBytes(32);
  await store.set(SECRET_KEY, generated.toString('hex'));
  cached = generated;
  return cached;
}

/** Purpose-separated subkeys, so one use cannot be replayed against another. */
async function subkey(purpose: string): Promise<Buffer> {
  return createHmac('sha256', await rootSecret()).update(purpose).digest();
}

export const signingKey = () => subkey('session-cookie');

/**
 * Turns a password into the index it is stored under. Because the peppering
 * secret is not in the store, an index value cannot be worked back to its
 * password by anyone holding only the store, and lookup stays a single O(1)
 * read rather than a scan over every key.
 */
export async function lookupIndex(password: string): Promise<string> {
  const key = await subkey('key-lookup');
  return createHmac('sha256', key).update(password.normalize('NFKC')).digest('base64url');
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await subkey('key-at-rest');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join(
    '.',
  );
}

export async function decryptSecret(packed: string): Promise<string | null> {
  try {
    const [iv, tag, body] = packed.split('.');
    if (!iv || !tag || !body) return null;
    const key = await subkey('key-at-rest');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * A uniformly random integer below `bound`. Rejection sampling rather than a
 * modulo, which would quietly bias the low end of the word list.
 */
function randomBelow(bound: number): number {
  const limit = Math.floor(0xffffffff / bound) * bound;
  for (;;) {
    const value = randomBytes(4).readUInt32BE(0);
    if (value < limit) return value % bound;
  }
}

/**
 * A passphrase that survives being read aloud down a phone line: three words
 * and a four-digit number, roughly 42 bits. The word list size is what carries
 * this — the same shape drawn from a thirty-word list is barely a PIN.
 */
export function generatePassphrase(): string {
  const picks: string[] = [];
  while (picks.length < 3) {
    const word = WORDS[randomBelow(WORDS.length)];
    if (!picks.includes(word)) picks.push(word);
  }
  return `${picks.join('-')}-${1000 + randomBelow(9000)}`;
}

/** Entropy of a passphrase this generator produced, for documentation and tests. */
export const GENERATED_BITS = Math.log2(WORDS.length * (WORDS.length - 1) * (WORDS.length - 2) * 9000);

const WORD_SET = new Set(WORDS);

/**
 * What one recognisable English word costs a guesser, in bits.
 *
 * Charging only log2(this list) would be far too harsh: a person choosing their
 * own words is not choosing from these 865, so an attacker must walk a general
 * dictionary. Charging a full English dictionary would be too generous, since
 * this list is public and a guesser would try it first. A Diceware-sized 4,096
 * sits between the two and is the conservative side of realistic.
 */
const WORD_BITS = 12;

/**
 * The passwords guessers try first. Not a security control on its own — the
 * global failure ceiling is that — but it catches the choices that would make
 * every other defence pointless.
 */
const COMMON = new Set(
  `password passwd pass secret letmein welcome admin administrator login user guest
   qwerty qwertyuiop asdf asdfgh asdfghjkl zxcvbn zxcvbnm dragon monkey master
   shadow sunshine princess football baseball soccer superman batman iloveyou
   trustno hello hallo test testing temp temporary changeme default root toor
   abc abcd abcde abcdef abcdefg access money freedom whatever qazwsx starwars
   michael jennifer jordan harley ranger hunter buster thomas robert charlie
   summer winter spring autumn january february chocolate cookie pepper ginger
   samsung google apple facebook internet computer server database backup
   private public secure open enter unlock key pin code word phrase board
   bulletin corkboard`
    .split(/\s+/)
    .filter(Boolean),
);

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '+': 't',
};

const deLeet = (value: string) =>
  value.replace(/[013457 8@$!+]/g, (ch) => LEET[ch] ?? ch);

/** Runs like abcdef, 123456, or a walk along one keyboard row. */
function isRun(value: string): boolean {
  if (value.length < 4) return false;
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abcdefghijklmnopqrstuvwxyz', '0123456789'];
  const forward = value.toLowerCase();
  const backward = [...forward].reverse().join('');
  return rows.some((row) => row.includes(forward) || row.includes(backward));
}

/** A token stripped of decoration, for comparison against the common list. */
function bareToken(value: string): string {
  return deLeet(value.toLowerCase()).replace(/[^a-z]/g, '');
}

/**
 * A deliberately rough LOWER bound on how hard a password is to guess.
 *
 * It is not zxcvbn and does not pretend to be. It scores the password as a
 * sequence of chunks, giving each chunk only what a guesser would have to pay
 * for it: almost nothing for a well-known password or a keyboard run, one draw
 * from a dictionary for an ordinary word, and character-level cost only for
 * chunks that look like nothing in particular. Where the readings disagree it
 * takes the weakest, because an attacker would too.
 *
 * Treat it as a floor that rejects bad choices, not a promise about good ones.
 * The generated passphrase is the reliable option.
 */
export function estimateBits(password: string, forbidden: string[] = []): number {
  const value = password.normalize('NFKC').trim();
  if (!value) return 0;
  if (new Set(value).size <= 2) return 0;

  const whole = bareToken(value);
  if (COMMON.has(whole)) return 4;
  if (isRun(value.replace(/[^a-zA-Z0-9]/g, ''))) return 4;
  for (const word of forbidden) {
    const bare = bareToken(word);
    if (bare.length >= 4 && whole.includes(bare)) return 6;
  }

  const chunks = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // An unbroken string still gets split, so that "passwordpassword" is not
  // mistaken for sixteen random characters.
  const tokens = chunks.length > 1 ? chunks : [value.toLowerCase()];

  let bits = 0;
  for (const token of tokens) {
    const bare = bareToken(token);
    if (/^\d+$/.test(token)) {
      // Years and dates are the overwhelmingly common case for digit runs.
      bits += token.length <= 4 ? Math.log2(10 ** token.length) : Math.log2(10 ** 4) + (token.length - 4);
    } else if (COMMON.has(bare) || isRun(token)) {
      bits += 5;
    } else if (WORD_SET.has(bare)) {
      bits += WORD_BITS;
    } else {
      // Unknown chunk: charge character-level cost, but never more than one
      // draw from a large dictionary plus a little, since most unknown chunks
      // are still words this list happens not to carry.
      let charset = 0;
      if (/[a-z]/.test(token)) charset += 26;
      if (/[A-Z]/.test(password)) charset += 26;
      if (/[0-9]/.test(token)) charset += 10;
      if (/[^a-z0-9]/i.test(token)) charset += 33;
      const raw = token.length * Math.log2(Math.max(charset, 2));
      bits += Math.min(raw, Math.log2(120000) + Math.max(0, token.length - 8) * 2);
    }
  }

  // Separators carry a little information themselves, but only a little.
  if (tokens.length > 1) bits += Math.log2(tokens.length);

  return Math.round(bits * 10) / 10;
}
