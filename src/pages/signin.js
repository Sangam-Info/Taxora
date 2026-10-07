import { signIn } from '../services/auth.js';
import { redirectIfSignedIn } from '../services/session.js';
import { validateEmail, validateSignInPassword } from '../lib/validation.js';
import { friendlyError } from '../lib/errors.js';
import { takeFlash } from '../lib/flash.js';
import {
  createValidator,
  setButtonState,
  succeed,
  showAlert,
  clearAlert,
  setupPasswordToggles,
  revealPage,
} from '../lib/ui.js';

const WRONG_DETAILS = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/wrong-password',
  'auth/user-not-found',
]);

async function main() {
  if (await redirectIfSignedIn()) return;
  revealPage();
  setupPasswordToggles();

  const form = document.getElementById('signin-form');
  const alert = document.getElementById('signin-alert');
  const submit = form.querySelector('[type="submit"]');
  const validator = createValidator(form, { email: validateEmail, password: validateSignInPassword });

  // Arriving from sign-up: confirm the account and pre-fill the email.
  const flash = takeFlash();
  if (flash?.type === 'registered') {
    showAlert(alert, 'Account created successfully. Please sign in.', 'success');
    if (flash.email) form.email.value = flash.email;
    form.password.focus();
  }

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
      succeed(submit, () => window.location.replace('/dashboard'));
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setButtonState(submit, 'idle');
      // Wrong details: clear the password so it can be re-typed straight away.
      if (WRONG_DETAILS.has(error?.code)) form.password.value = '';
      form.password.focus();
    }
  });
}

main();
