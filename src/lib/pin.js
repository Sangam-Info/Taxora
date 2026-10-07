/**
 * Client PINs are never stored. Only a salted PBKDF2-SHA256 hash is saved in
 * Firestore, so the PIN itself can't be read back from the database.
 */
const ITERATIONS = 120000;
const encoder = new TextEncoder();

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((byte) => parseInt(byte, 16)));

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

/** Returns { pinHash, pinSalt } as hex strings. */
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pinHash: await derive(pin, salt), pinSalt: toHex(salt) };
}

export async function verifyPin(pin, { pinHash, pinSalt }) {
  if (!pinHash || !pinSalt) return false;
  const candidate = await derive(pin, fromHex(pinSalt));
  // Compare every character so timing doesn't hint at how much matched.
  let diff = candidate.length ^ pinHash.length;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ pinHash.charCodeAt(i % pinHash.length);
  return diff === 0;
}
