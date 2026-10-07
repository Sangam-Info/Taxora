import { signIn } from '../services/auth.js';
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

async function main() {
  if (await redirectIfSignedIn()) return;
  revealPage();
  setupPasswordToggles();

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
      succeed(submit, () => window.location.replace('/dashboard'));
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setButtonState(submit, 'idle');
    }
  });
}

main();
