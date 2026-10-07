import { signIn, resetPassword } from '../services/auth.js';
import { redirectIfSignedIn } from '../services/session.js';
import { validateEmail, validateSignInPassword } from '../lib/validation.js';
import { friendlyError } from '../lib/errors.js';
import {
  createValidator,
  setButtonState,
  succeed,
  showAlert,
  clearAlert,
  setupPasswordToggles,
  revealPage,
} from '../lib/ui.js';

const RESET_SENT =
  'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.';

const goToDashboard = () => window.location.replace('/dashboard');

async function main() {
  if (await redirectIfSignedIn()) return;
  revealPage();
  setupPasswordToggles();

  const signinView = document.getElementById('signin-view');
  const resetView = document.getElementById('reset-view');

  // ---- Email + password ----
  const form = document.getElementById('signin-form');
  const alert = document.getElementById('signin-alert');
  const submit = form.querySelector('[type="submit"]');
  const validator = createValidator(form, { email: validateEmail, password: validateSignInPassword });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!validator.validate()) return;

    setButtonState(submit, 'loading');
    try {
      await signIn({
        email: form.email.value.trim(),
        password: form.password.value,
        remember: form.remember.checked,
      });
      succeed(submit, goToDashboard);
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setButtonState(submit, 'idle');
    }
  });

  // ---- Password reset ----
  const resetForm = document.getElementById('reset-form');
  const resetAlert = document.getElementById('reset-alert');
  const resetSubmit = resetForm.querySelector('[type="submit"]');
  const resetValidator = createValidator(resetForm, { email: validateEmail });

  document.getElementById('forgot-link').addEventListener('click', () => {
    resetForm.email.value = form.email.value.trim();
    clearAlert(resetAlert);
    setButtonState(resetSubmit, 'idle');
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

    setButtonState(resetSubmit, 'loading');
    try {
      await resetPassword(resetForm.email.value.trim());
      showAlert(resetAlert, RESET_SENT, 'success');
      setButtonState(resetSubmit, 'success');
      setTimeout(() => setButtonState(resetSubmit, 'idle'), 2400);
    } catch (error) {
      // Same message whether or not the account exists, so emails can't be probed.
      if (error?.code === 'auth/user-not-found') {
        showAlert(resetAlert, RESET_SENT, 'success');
      } else {
        showAlert(resetAlert, friendlyError(error));
      }
      setButtonState(resetSubmit, 'idle');
    }
  });
}

main();
