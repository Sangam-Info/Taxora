import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const userRef = (uid) => doc(db, 'users', uid);

function newProfile(user, fullName) {
  return {
    uid: user.uid,
    fullName,
    email: user.email,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
}

/** Creates the Auth account and its Firestore profile. Rolls back the account if the profile can't be saved. */
export async function signUp({ fullName, email, password }) {
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  try {
    await updateProfile(user, { displayName: fullName });
    await setDoc(userRef(user.uid), newProfile(user, fullName));
  } catch (error) {
    await user.delete().catch(() => {});
    throw error;
  }
  return user;
}

export async function signIn({ email, password, remember }) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  await syncProfile(user);
  return user;
}

/** Makes sure a profile exists and records the sign-in time. */
export async function syncProfile(user) {
  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const name = (user.displayName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    await setDoc(ref, newProfile(user, name.length >= 2 ? name : 'Taxora user'));
    return;
  }

  try {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  } catch (error) {
    // A missed timestamp update should never block sign-in.
    console.warn('Could not record sign-in time', error);
  }
}

export async function getProfile(uid) {
  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export function logOut() {
  return signOut(auth);
}
