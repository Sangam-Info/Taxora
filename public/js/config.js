// ─────────────────────────────────────────────────────────────
// Firebase web configuration
// Replace these values with your Firebase project configuration.
// Firebase Console → Project settings → General → Your apps → Web app → Config
//
// These values are PUBLIC identifiers, not secrets. They are safe to ship
// in frontend code. Your data is protected by Firebase Authentication and
// Firestore Security Rules (see firestore.rules), not by hiding this object.
//
// NEVER put a service-account JSON / Firebase Admin private key here.
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_YOUR_API_KEY',
  authDomain: 'REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId: 'REPLACE_WITH_YOUR_APP_ID'
};
