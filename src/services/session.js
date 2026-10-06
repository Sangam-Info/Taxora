import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase.js';

export async function getCurrentUser() {
  await auth.authStateReady();
  return auth.currentUser;
}

/** For sign-in and sign-up pages. Returns true if the visitor was sent to the dashboard. */
export async function redirectIfSignedIn(to = '/dashboard') {
  if (await getCurrentUser()) {
    window.location.replace(to);
    return true;
  }
  return false;
}

/** For protected pages. Returns the user, or null after redirecting to sign-in. */
export async function requireUser(to = '/') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.replace(to);
    return null;
  }
  // Signing out in another tab ends this session too.
  onAuthStateChanged(auth, (current) => {
    if (!current) window.location.replace(to);
  });
  return user;
}
