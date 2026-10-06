// Single place where Firebase is initialised. Every page imports from here.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const isConfigured = !Object.values(firebaseConfig).some((v) => String(v).includes('REPLACE_WITH'));

if (!isConfigured) {
  console.error('Firebase is not configured. Add your project values to public/js/config.js.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
