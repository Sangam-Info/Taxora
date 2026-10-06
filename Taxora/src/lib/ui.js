/** Shows the page once the auth check has finished, so protected content never flashes. */
export function revealPage() {
  document.querySelector('[data-page]')?.removeAttribute('hidden');
}

export function showAlert(el, message, tone = 'error') {
  el.textContent = message;
  el.dataset.tone = tone;
  el.hidden = false;
}

export function clearAlert(el) {
  el.hidden = true;
  el.textContent = '';
}

export function setBusy(button, busy) {
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  button.textContent = busy ? button.dataset.busyLabel : button.dataset.label;
}

export function setupPasswordToggles(root = document) {
  root.querySelectorAll('.reveal').forEach((button) => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}

function setFieldError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  if (errorEl) errorEl.textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

/**
 * Validates on blur once a field has a value, then live after the first check.
 * rules: { fieldName: (value, form) => errorMessage | '' }
 */
export function createValidator(form, rules) {
  const touched = new Set();
  const names = Object.keys(rules);

  const check = (name) => {
    const input = form.elements[name];
    const message = rules[name](input.value, form);
    setFieldError(input, message);
    return !message;
  };

  names.forEach((name) => {
    const input = form.elements[name];
    input.addEventListener('blur', () => {
      if (input.value) {
        touched.add(name);
        check(name);
      }
    });
    input.addEventListener('input', () => {
      if (touched.has(name)) check(name);
    });
  });

  return {
    recheck(name) {
      if (touched.has(name)) check(name);
    },
    validate() {
      let firstInvalid = null;
      names.forEach((name) => {
        touched.add(name);
        if (!check(name) && !firstInvalid) firstInvalid = form.elements[name];
      });
      firstInvalid?.focus();
      return !firstInvalid;
    },
  };
}
