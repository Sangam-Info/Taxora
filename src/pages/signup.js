import { signUp } from '../services/auth.js';
import { redirectIfSignedIn } from '../services/session.js';
import { validateName, validateEmail, validateNewPassword, validateConfirm, passwordChecks } from '../lib/validation.js';
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

  const form = document.getElementById('signup-form');
  const alert = document.getElementById('signup-alert');
  const submit = form.querySelector('[type="submit"]');
  const rulesWrap = document.getElementById('su-rules-wrap');
  const ruleItems = rulesWrap.querySelectorAll('[data-rule]');

  const validator = createValidator(form, {
    fullName: validateName,
    email: validateEmail,
    password: validateNewPassword,
    confirmPassword: (value, f) => validateConfirm(value, f.password.value),
  });

  const updateRules = () => {
    const value = form.password.value;
    rulesWrap.classList.toggle('open', value.length > 0 || document.activeElement === form.password);
    ruleItems.forEach((item) => {
      item.classList.toggle('met', passwordChecks[item.dataset.rule](value));
    });
  };

  form.password.addEventListener('focus', updateRules);
  form.password.addEventListener('blur', updateRules);
  form.password.addEventListener('input', () => {
    updateRules();
    validator.recheck('confirmPassword');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    rulesWrap.classList.add('open');
    if (!validator.validate()) return;

    setButtonState(submit, 'loading');
    try {
      await signUp({
        fullName: form.fullName.value.trim().replace(/\s+/g, ' '),
        email: form.email.value.trim(),
        password: form.password.value,
      });
      succeed(submit, () => window.location.replace('/dashboard'));
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setButtonState(submit, 'idle');
    }
  });
}

main();
