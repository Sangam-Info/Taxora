// Shared form helpers: field errors, form alerts, loading state, error mapping.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function setFieldError(input, message) {
  const errorEl = document.getElementById(`${input.id}-error`);
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.textContent = message;
  } else {
    input.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  }
}

export function clearErrors(form) {
  form.querySelectorAll('input').forEach((input) => setFieldError(input, ''));
  showAlert(form, '');
}

// type: 'error' | 'success'. Uses textContent only, so nothing is ever rendered as HTML.
export function showAlert(form, message, type = 'error') {
  const alert = form.querySelector('.form-alert');
  if (!alert) return;
  alert.textContent = message;
  alert.className = message ? `form-alert is-visible is-${type}` : 'form-alert';
  alert.setAttribute('role', type === 'error' ? 'alert' : 'status');
}

export function setLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.label = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

// Converts Firebase error codes into user-friendly text. Raw errors never reach the UI.
export function friendlyAuthError(error) {
  const code = error && error.code ? error.code : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
    case 'permission-denied':
      return 'Sign-in is not set up correctly yet. Please contact support.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
