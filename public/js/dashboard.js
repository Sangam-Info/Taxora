import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, db } from './firebase.js';

const nameEl = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');

// Route guard: the page stays hidden until Firebase confirms a signed-in user.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace('/signin');
    return;
  }

  let displayName = user.email;
  try {
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    if (snapshot.exists() && snapshot.data().name) displayName = snapshot.data().name;
  } catch {
    // Fall back to the email if the profile can't be read.
  }

  nameEl.textContent = displayName; // textContent → user data is never parsed as HTML
  document.body.classList.remove('is-guarded');
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Logging out...';
  try {
    await signOut(auth);
  } finally {
    window.location.replace('/signin');
  }
});
