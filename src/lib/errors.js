const WRONG_CREDENTIALS = 'Email or password is incorrect.';
const BAD_CONFIG = 'Taxora’s Firebase settings are invalid. Check the environment variables and rebuild.';

const MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead, or reset your password.',
  'auth/invalid-email': 'Enter a valid email address, like name@company.com.',
  'auth/missing-email': 'Enter your email address.',
  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/invalid-login-credentials': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/user-disabled': 'This account has been disabled. Contact support to restore access.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'Can’t reach the server. Check your internet connection and try again.',
  'auth/weak-password': 'Choose a stronger password: at least 8 characters with a letter and a number.',
  'auth/password-does-not-meet-requirements': 'This password doesn’t meet the security requirements. Try a longer mix of letters and numbers.',
  'auth/operation-not-allowed': 'Email sign-in is turned off. Enable Email/Password in Firebase Console under Authentication → Sign-in method.',
  'auth/requires-recent-login': 'Sign in again to continue.',
  'auth/invalid-api-key': BAD_CONFIG,
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': BAD_CONFIG,
  'auth/unauthorized-domain': 'This website isn’t on the Firebase authorized domains list. Add it under Authentication settings.',
  'auth/configuration-not-found': 'Firebase Authentication isn’t set up yet. In Firebase Console, open Authentication, click Get started, and enable Email/Password.',
  'auth/admin-restricted-operation': 'New sign-ups are blocked in Firebase. Turn on user sign-up under Authentication → Settings → User actions.',
  'auth/internal-error': 'Firebase returned an internal error. Check that Authentication is set up and this domain is authorised.',
  'not-found': 'The Firestore database doesn’t exist yet. Create it in Firebase Console under Firestore Database.',
  'permission-denied': 'Your account details couldn’t be saved. Make sure the Firestore security rules are published.',
  'unavailable': 'The database is unreachable right now. Check your connection and try again.',
  'failed-precondition': 'The database isn’t set up yet. Create a Firestore database in Firebase Console.',
};

export function friendlyError(error) {
  console.error(error);
  const code = error?.code;
  if (MESSAGES[code]) return MESSAGES[code];
  // Show the code so unexpected problems can be diagnosed quickly.
  return code ? `Something went wrong (${code}). Try again in a moment.` : 'Something went wrong. Try again in a moment.';
}
