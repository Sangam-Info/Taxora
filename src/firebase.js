import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  const message = `Firebase is not configured. Missing: ${missing.join(', ')}. Copy .env.example to .env (or set the variables in Cloudflare) and rebuild.`;
  document.body.textContent = message;
  throw new Error(message);
}

export const app = initializeApp(config);

// Email/password only: no popup/redirect resolver, which keeps the bundle small
// and avoids loading third-party iframes.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});

export const db = getFirestore(app);
