import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { hashPin, verifyPin } from '../lib/pin.js';

// Clients live under their owner: users/{uid}/clients/{clientId}.
const clientsCol = (uid) => collection(db, 'users', uid, 'clients');
const clientRef = (uid, id) => doc(db, 'users', uid, 'clients', id);

const withId = (snapshot) => ({ id: snapshot.id, ...snapshot.data() });

/** Live list of the user's clients, A–Z. Returns an unsubscribe function. */
export function watchClients(uid, onData, onError) {
  return onSnapshot(
    query(clientsCol(uid), orderBy('nameLower')),
    (snapshot) => onData(snapshot.docs.map(withId)),
    onError,
  );
}

/** Live single client. Calls onData(null) if it doesn't exist (or was deleted). */
export function watchClient(uid, id, onData, onError) {
  return onSnapshot(
    clientRef(uid, id),
    (snapshot) => onData(snapshot.exists() ? withId(snapshot) : null),
    onError,
  );
}

/** Returns another client of this user with the same PAN, or null. */
export async function findClientByPan(uid, pan, exceptId = null) {
  const snapshot = await getDocs(query(clientsCol(uid), where('pan', '==', pan), limit(2)));
  const match = snapshot.docs.map(withId).find((client) => client.id !== exceptId);
  return match ?? null;
}

/** details: the cleaned form values. pin: optional new PIN. Returns the new client's id. */
export async function createClient(uid, details, pin = '') {
  const pinFields = pin ? { hasPin: true, ...(await hashPin(pin)) } : { hasPin: false, pinHash: null, pinSalt: null };
  const ref = await addDoc(clientsCol(uid), {
    ownerId: uid,
    ...details,
    nameLower: details.name.toLowerCase(),
    ...pinFields,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function updateClient(uid, id, details) {
  return updateDoc(clientRef(uid, id), {
    ...details,
    nameLower: details.name.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

export async function setClientPin(uid, id, pin) {
  return updateDoc(clientRef(uid, id), { hasPin: true, ...(await hashPin(pin)), updatedAt: serverTimestamp() });
}

export function removeClientPin(uid, id) {
  return updateDoc(clientRef(uid, id), { hasPin: false, pinHash: null, pinSalt: null, updatedAt: serverTimestamp() });
}

export function deleteClient(uid, id) {
  return deleteDoc(clientRef(uid, id));
}

export function checkClientPin(client, pin) {
  return verifyPin(pin, client);
}

/** Confirms the signed-in user's account password (used to reset a forgotten client PIN). */
export async function confirmAccountPassword(password) {
  const user = auth.currentUser;
  if (!user?.email) throw Object.assign(new Error('Not signed in'), { code: 'auth/requires-recent-login' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}
