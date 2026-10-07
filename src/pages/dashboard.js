import { getProfile, syncProfile, logOut } from '../services/auth.js';
import { requireUser } from '../services/session.js';
import { friendlyError } from '../lib/errors.js';
import { setBusy, succeed, showAlert, revealPage } from '../lib/ui.js';

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (timestamp) => (timestamp?.toDate ? dateFormat.format(timestamp.toDate()) : '—');
const setText = (id, value) => {
  document.getElementById(id).textContent = value;
};

async function loadProfile(user) {
  let profile = await getProfile(user.uid);
  if (!profile) {
    await syncProfile(user);
    profile = await getProfile(user.uid);
  }
  return profile;
}

function render(user, profile) {
  const name = profile?.fullName || user.displayName || 'there';
  setText('welcome', `Welcome, ${name.split(' ')[0]}`);
  setText('d-name', profile?.fullName || user.displayName || '—');
  setText('d-email', user.email);
  setText('d-created', formatDate(profile?.createdAt));
  setText('d-last', formatDate(profile?.lastLoginAt));
}

async function main() {
  const user = await requireUser();
  if (!user) return;

  const alert = document.getElementById('dash-alert');
  let profile = null;
  try {
    profile = await loadProfile(user);
  } catch (error) {
    showAlert(alert, friendlyError(error));
  }
  render(user, profile);
  revealPage();

  const signOutButton = document.getElementById('signout');
  signOutButton.addEventListener('click', async () => {
    setBusy(signOutButton, true);
    try {
      await logOut();
      succeed(signOutButton, () => window.location.replace('/'), 400);
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(signOutButton, false);
    }
  });
}

main();
