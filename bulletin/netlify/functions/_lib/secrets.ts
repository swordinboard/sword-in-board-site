import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  createHash,
  randomBytes,
} from 'node:crypto';
import { getStore } from '@netlify/blobs';

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

const WORDS = [
  'amber', 'anchor', 'atlas', 'bramble', 'cedar', 'cobble', 'copper', 'ember',
  'fathom', 'ferry', 'garnet', 'harbour', 'hollow', 'kettle', 'lantern', 'marble',
  'meadow', 'orchard', 'pebble', 'quarry', 'ribbon', 'rooster', 'saffron', 'sparrow',
  'thistle', 'timber', 'velvet', 'walnut', 'willow', 'wander', 'yonder', 'zephyr',
];

/** A passphrase that survives being read aloud down a phone line. */
export function generatePassphrase(): string {
  const picks: string[] = [];
  while (picks.length < 3) {
    const word = WORDS[randomBytes(1)[0] % WORDS.length];
    if (!picks.includes(word)) picks.push(word);
  }
  const number = (randomBytes(2).readUInt16BE(0) % 90) + 10;
  return `${picks.join('-')}-${number}`;
}
