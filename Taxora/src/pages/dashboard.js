import { getProfile, syncProfile, logOut, resendVerification, refreshVerification } from '../services/auth.js';
import { requireUser } from '../services/session.js';
import { friendlyError } from '../lib/errors.js';
import { setBusy, showAlert, clearAlert, revealPage } from '../lib/ui.js';

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (timestamp) => (timestamp?.toDate ? dateFormat.format(timestamp.toDate()) : '—');
const setText = (id, value) => {
  document.getElementById(id).textContent = value;
};

const RESEND_COOLDOWN_SECONDS = 60;

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
  setText('d-verified', user.emailVerified ? 'Confirmed' : 'Not confirmed yet');
  setText('d-created', formatDate(profile?.createdAt));
  setText('d-last', formatDate(profile?.lastLoginAt));

  const notice = document.getElementById('verify-notice');
  notice.hidden = user.emailVerified;
  setText('verify-email', user.email);
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

  // Sign out
  const signOutButton = document.getElementById('signout');
  signOutButton.addEventListener('click', async () => {
    setBusy(signOutButton, true);
    try {
      await logOut();
      window.location.replace('/');
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(signOutButton, false);
    }
  });

  // Email confirmation
  const checkButton = document.getElementById('verify-check');
  checkButton.addEventListener('click', async () => {
    clearAlert(alert);
    setBusy(checkButton, true);
    try {
      if (await refreshVerification(user)) {
        render(user, await getProfile(user.uid));
        showAlert(alert, 'Email confirmed.', 'success');
      } else {
        showAlert(alert, 'Not confirmed yet. Open the link in the email we sent, then try again.');
      }
    } catch (error) {
      showAlert(alert, friendlyError(error));
    } finally {
      setBusy(checkButton, false);
    }
  });

  const resendButton = document.getElementById('verify-resend');
  resendButton.addEventListener('click', async () => {
    clearAlert(alert);
    setBusy(resendButton, true);
    try {
      await resendVerification(user);
      showAlert(alert, `Confirmation email sent to ${user.email}.`, 'success');
      startCooldown(resendButton);
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(resendButton, false);
    }
  });
}

function startCooldown(button) {
  let remaining = RESEND_COOLDOWN_SECONDS;
  button.disabled = true;
  const tick = () => {
    if (remaining <= 0) {
      setBusy(button, false);
      return;
    }
    button.textContent = `Resend in ${remaining}s`;
    remaining -= 1;
    setTimeout(tick, 1000);
  };
  tick();
}

main();
