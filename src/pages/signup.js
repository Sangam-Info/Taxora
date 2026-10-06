import { signUp } from '../services/auth.js';
import { redirectIfSignedIn } from '../services/session.js';
import { validateName, validateEmail, validateNewPassword, validateConfirm, passwordChecks } from '../lib/validation.js';
import { friendlyError } from '../lib/errors.js';
import { createValidator, setBusy, showAlert, clearAlert, setupPasswordToggles, revealPage } from '../lib/ui.js';

async function main() {
  if (await redirectIfSignedIn()) return;
  revealPage();
  setupPasswordToggles();

  const form = document.getElementById('signup-form');
  const alert = document.getElementById('signup-alert');
  const submit = form.querySelector('[type="submit"]');
  const ruleItems = form.querySelectorAll('.rules [data-rule]');

  const validator = createValidator(form, {
    fullName: validateName,
    email: validateEmail,
    password: validateNewPassword,
    confirmPassword: (value, f) => validateConfirm(value, f.password.value),
  });

  form.password.addEventListener('input', () => {
    const value = form.password.value;
    ruleItems.forEach((item) => {
      item.classList.toggle('met', passwordChecks[item.dataset.rule](value));
    });
    validator.recheck('confirmPassword');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!validator.validate()) return;

    setBusy(submit, true);
    try {
      await signUp({
        fullName: form.fullName.value.trim().replace(/\s+/g, ' '),
        email: form.email.value.trim(),
        password: form.password.value,
      });
      window.location.replace('/dashboard');
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(submit, false);
    }
  });
}

main();
