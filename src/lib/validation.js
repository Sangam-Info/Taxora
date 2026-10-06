const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export const passwordChecks = {
  length: (value) => value.length >= 8,
  letter: (value) => /\p{L}/u.test(value),
  number: (value) => /\d/.test(value),
};

export function validateName(value) {
  const name = value.trim();
  if (!name) return 'Enter your full name.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 80) return 'Name must be 80 characters or fewer.';
  if (!NAME.test(name)) return 'Use letters, spaces, dots, hyphens or apostrophes only.';
  return '';
}

export function validateEmail(value) {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (email.length > 254 || !EMAIL.test(email)) return 'Enter a valid email address, like name@company.com.';
  return '';
}

export function validateSignInPassword(value) {
  return value ? '' : 'Enter your password.';
}

export function validateNewPassword(value) {
  if (!value) return 'Create a password.';
  if (value.length > 128) return 'Password must be 128 characters or fewer.';
  if (!Object.values(passwordChecks).every((check) => check(value))) {
    return 'Use at least 8 characters with a letter and a number.';
  }
  return '';
}

export function validateConfirm(value, password) {
  if (!value) return 'Re-enter your password.';
  if (value !== password) return 'Passwords don’t match.';
  return '';
}
