const KEY = 'taxora:flash';

/** Stores a one-time message for the next page. */
export function setFlash(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage blocked: the next page simply shows no message.
  }
}

/** Reads and clears the one-time message, or returns null. */
export function takeFlash() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
