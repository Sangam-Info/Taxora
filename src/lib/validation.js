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

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^[0-9]{9,18}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const PERIOD_RE = /^[0-9]{4}-[0-9]{2}$/;

export const upper = (value) => value.trim().toUpperCase().replace(/\s+/g, '');

/** Strips spaces, dashes, a leading +91 / 91 / 0, leaving the 10-digit mobile number. */
export function normalizePhone(value) {
  let digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.replace(/\D/g, '');
}

export function validateClientName(value) {
  const name = value.trim();
  if (!name) return 'Enter the client’s name.';
  if (name.length < 2) return 'Name must be at least 2 characters.';
  if (name.length > 120) return 'Name must be 120 characters or fewer.';
  return '';
}

export function validateItrPeriod(value) {
  return PERIOD_RE.test(value) ? '' : 'Choose the ITR period.';
}

export function validateAddress(value) {
  const address = value.trim();
  if (!address) return 'Enter the client’s address.';
  if (address.length < 5) return 'Enter the full address.';
  if (address.length > 300) return 'Address must be 300 characters or fewer.';
  return '';
}

export function validatePhone(value) {
  if (!value.trim()) return 'Enter a phone number.';
  return MOBILE_RE.test(normalizePhone(value)) ? '' : 'Enter a valid 10-digit Indian mobile number.';
}

export function validateOptionalEmail(value) {
  const email = value.trim();
  if (!email) return '';
  return email.length <= 254 && EMAIL.test(email) ? '' : 'Enter a valid email address, like name@company.com.';
}

export function validatePan(value) {
  const pan = upper(value);
  if (!pan) return 'Enter the PAN.';
  return PAN_RE.test(pan) ? '' : 'Enter a valid PAN, like ABCDE1234F.';
}

/** GSTIN is optional; when given it must be valid and carry the same PAN. */
export function validateGstin(value, pan) {
  const gstin = upper(value);
  if (!gstin) return '';
  if (!GSTIN_RE.test(gstin)) return 'Enter a valid 15-character GSTIN, like 24ABCDE1234F1Z5.';
  const panValue = upper(pan);
  if (PAN_RE.test(panValue) && gstin.slice(2, 12) !== panValue) return 'This GSTIN doesn’t match the PAN entered above.';
  return '';
}

export function validateAccountNumber(value, ifsc) {
  const account = value.replace(/\s+/g, '');
  if (!account) return upper(ifsc) ? 'Enter the account number for this IFSC.' : '';
  return ACCOUNT_RE.test(account) ? '' : 'Account number must be 9 to 18 digits.';
}

export function validateIfsc(value, account) {
  const ifsc = upper(value);
  if (!ifsc) return account.replace(/\s+/g, '') ? 'Enter the IFSC for this account.' : '';
  return IFSC_RE.test(ifsc) ? '' : 'Enter a valid IFSC, like SBIN0001234.';
}

export function validateOptionalText(max, label) {
  return (value) => (value.trim().length > max ? `${label} must be ${max} characters or fewer.` : '');
}

export function validatePin(value) {
  if (!value) return 'Enter a PIN.';
  return /^[0-9]{4,6}$/.test(value) ? '' : 'PIN must be 4 to 6 digits.';
}

/** For the optional PIN on the add-client form. */
export function validateOptionalPin(value) {
  return value ? validatePin(value) : '';
}

export function validatePinConfirm(value, pin) {
  if (!pin && !value) return '';
  if (!value) return 'Re-enter the PIN.';
  return value === pin ? '' : 'PINs don’t match.';
}

export function validateCurrentPin(value) {
  return value ? '' : 'Enter the current PIN.';
}
