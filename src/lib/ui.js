const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Shows the page once the auth check has finished, so protected content never flashes. */
export function revealPage() {
  document.querySelector('[data-page]')?.removeAttribute('hidden');
  // SVG (SMIL) motion ignores CSS; pause it for people who prefer less motion.
  if (reducedMotion) document.querySelectorAll('svg.backdrop').forEach((svg) => svg.pauseAnimations?.());
}

export function showAlert(el, message, tone = 'error') {
  el.hidden = true;
  el.textContent = message;
  el.dataset.tone = tone;
  // Re-trigger the entrance animation for repeated messages.
  void el.offsetWidth;
  el.hidden = false;
}

export function clearAlert(el) {
  el.hidden = true;
  el.textContent = '';
}

/**
 * Button states: idle → loading → success (or back to idle).
 * Labels come from data-busy-label / data-done-label on the button.
 */
export function setButtonState(button, state) {
  const text = button.querySelector('.btn-text') ?? button;
  if (!button.dataset.label) button.dataset.label = text.textContent;

  const labels = {
    idle: button.dataset.label,
    loading: button.dataset.busyLabel ?? button.dataset.label,
    success: button.dataset.doneLabel ?? button.dataset.label,
  };
  text.textContent = labels[state];
  button.dataset.state = state;
  button.disabled = state !== 'idle';
  button.setAttribute('aria-busy', String(state === 'loading'));
}

export const setBusy = (button, busy) => setButtonState(button, busy ? 'loading' : 'idle');

/** Shows the success state briefly, then runs `next` (usually a redirect). */
export function succeed(button, next, delay = 650) {
  setButtonState(button, 'success');
  setTimeout(next, reducedMotion ? 0 : delay);
}

export function setupPasswordToggles(root = document) {
  root.querySelectorAll('.reveal').forEach((button) => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  });
}

function setFieldError(input, message) {
  const field = input.closest('.field');
  const errorText = document.querySelector(`#${input.id}-error > span`);
  // Keep the old text while the message collapses, so it fades out instead of vanishing.
  if (message && errorText) errorText.textContent = message;
  field?.classList.toggle('has-error', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function nudge(input) {
  if (reducedMotion) return;
  const field = input.closest('.field');
  if (!field) return;
  field.classList.remove('shake');
  void field.offsetWidth;
  field.classList.add('shake');
  field.addEventListener('animationend', () => field.classList.remove('shake'), { once: true });
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
        if (!check(name)) {
          nudge(form.elements[name]);
          firstInvalid ??= form.elements[name];
        }
      });
      firstInvalid?.focus();
      return !firstInvalid;
    },
  };
}
