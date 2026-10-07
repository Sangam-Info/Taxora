/**
 * Tracks which PIN-protected clients are open ("logged in") in this browser tab,
 * plus wrong-PIN lockouts. Everything lives in sessionStorage, so closing the tab
 * or signing out locks every client again.
 */
const UNLOCKED = 'taxora:unlocked-clients';
const ATTEMPTS = 'taxora:pin-attempts';
const UNLOCK_MINUTES = 30;
export const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

function read(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}

function write(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: clients simply ask for the PIN every time.
  }
}

export function isUnlocked(clientId) {
  const until = read(UNLOCKED)[clientId];
  return typeof until === 'number' && until > Date.now();
}

export function unlockClient(clientId) {
  const map = read(UNLOCKED);
  map[clientId] = Date.now() + UNLOCK_MINUTES * 60 * 1000;
  write(UNLOCKED, map);
  clearAttempts(clientId);
}

export function lockClient(clientId) {
  const map = read(UNLOCKED);
  delete map[clientId];
  write(UNLOCKED, map);
}

export function lockAllClients() {
  try {
    sessionStorage.removeItem(UNLOCKED);
    sessionStorage.removeItem(ATTEMPTS);
  } catch {
    // Nothing stored.
  }
}

/** Seconds left on a wrong-PIN lockout, or 0. */
export function lockoutRemaining(clientId) {
  const entry = read(ATTEMPTS)[clientId];
  if (!entry?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((entry.lockedUntil - Date.now()) / 1000));
}

/** Records a wrong PIN. Returns attempts left before a lockout (0 means locked now). */
export function recordFailedAttempt(clientId) {
  const map = read(ATTEMPTS);
  const entry = map[clientId] ?? { count: 0 };
  entry.count += 1;
  let left = MAX_ATTEMPTS - entry.count;
  if (left <= 0) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    left = 0;
  }
  map[clientId] = entry;
  write(ATTEMPTS, map);
  return left;
}

export function clearAttempts(clientId) {
  const map = read(ATTEMPTS);
  delete map[clientId];
  write(ATTEMPTS, map);
}
