import { signIn, resetPassword } from '../services/auth.js';
import { redirectIfSignedIn } from '../services/session.js';
import { validateEmail, validateSignInPassword } from '../lib/validation.js';
import { friendlyError } from '../lib/errors.js';
import { createValidator, setBusy, showAlert, clearAlert, setupPasswordToggles, revealPage } from '../lib/ui.js';

async function main() {
  if (await redirectIfSignedIn()) return;
  revealPage();
  setupPasswordToggles();

  const signinView = document.getElementById('signin-view');
  const resetView = document.getElementById('reset-view');

  // Sign in
  const form = document.getElementById('signin-form');
  const alert = document.getElementById('signin-alert');
  const submit = form.querySelector('[type="submit"]');
  const validator = createValidator(form, { email: validateEmail, password: validateSignInPassword });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!validator.validate()) return;

    setBusy(submit, true);
    try {
      await signIn({
        email: form.email.value.trim(),
        password: form.password.value,
        remember: form.remember.checked,
      });
      window.location.replace('/dashboard');
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(submit, false);
    }
  });

  // Password reset
  const resetForm = document.getElementById('reset-form');
  const resetAlert = document.getElementById('reset-alert');
  const resetSubmit = resetForm.querySelector('[type="submit"]');
  const resetValidator = createValidator(resetForm, { email: validateEmail });

  document.getElementById('forgot-link').addEventListener('click', () => {
    resetForm.email.value = form.email.value.trim();
    clearAlert(resetAlert);
    signinView.hidden = true;
    resetView.hidden = false;
    resetForm.email.focus();
  });

  document.getElementById('back-link').addEventListener('click', () => {
    resetView.hidden = true;
    signinView.hidden = false;
    form.email.focus();
  });

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(resetAlert);
    if (!resetValidator.validate()) return;

    setBusy(resetSubmit, true);
    try {
      await resetPassword(resetForm.email.value.trim());
      // Same message whether or not the account exists, so emails can't be probed.
      showAlert(resetAlert, 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.', 'success');
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        showAlert(resetAlert, 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.', 'success');
      } else {
        showAlert(resetAlert, friendlyError(error));
      }
    } finally {
      setBusy(resetSubmit, false);
    }
  });
}

main();
