import { logOut } from '../services/auth.js';
import {
  watchClient,
  updateClient,
  findClientByPan,
  setClientPin,
  removeClientPin,
  deleteClient,
  checkClientPin,
  confirmAccountPassword,
} from '../services/clients.js';
import { requireUser } from '../services/session.js';
import { friendlyError } from '../lib/errors.js';
import { setFlash } from '../lib/flash.js';
import {
  isUnlocked,
  unlockClient,
  lockClient,
  lockAllClients,
  lockoutRemaining,
  recordFailedAttempt,
  clearAttempts,
} from '../lib/client-session.js';
import { mountClientForm } from '../lib/client-form.js';
import { setupDialog, openDialog, closeDialog, setDialogBusy } from '../lib/dialog.js';
import { showToast } from '../lib/toast.js';
import { formatDate, formatPhone, periodLabel, maskAccount, initials } from '../lib/format.js';
import { validatePin, validatePinConfirm, validateCurrentPin, validateSignInPassword } from '../lib/validation.js';
import { createValidator, setBusy, setButtonState, succeed, showAlert, clearAlert, revealPage } from '../lib/ui.js';

const $ = (id) => document.getElementById(id);
const setText = (id, value) => {
  $(id).textContent = value;
};

const WRONG_PASSWORD = new Set(['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password']);
const digitsOnly = (input) =>
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
  });
const confirmPinRule = (value, form) => validatePinConfirm(value, form.newPin.value) || (value ? '' : 'Re-enter the PIN.');

const goToDashboard = () => window.location.assign('/dashboard');

let uid;
let clientId;
let client = null;
let accountShown = false;

/**
 * Every client needs a PIN to be opened. Two exceptions keep the flow sensible:
 * - keepOpenWithoutPin: the PIN was just removed during this visit, so the view
 *   stays open until the client is closed (the next visit asks for a new PIN).
 * - resetVerified: the account password was confirmed via "Forgot PIN?", so
 *   a new PIN can be chosen without the old one.
 */
let keepOpenWithoutPin = false;
let resetVerified = false;

// ---------------------------------------------------------------------------
// States: loading → missing | locked (enter PIN / set PIN) | view
// ---------------------------------------------------------------------------

function showState(name) {
  for (const state of ['loading', 'missing', 'locked', 'view']) $(`state-${state}`).hidden = state !== name;
}

function render() {
  if (!client) {
    document.title = 'Client not found | Taxora';
    showState('missing');
    return;
  }
  document.title = `${client.name} | Taxora`;

  if (resetVerified) return showLocked('reset');
  if (client.hasPin) return isUnlocked(clientId) ? renderView() : showLocked('enter');
  return keepOpenWithoutPin ? renderView() : showLocked('required');
}

function renderView() {
  showState('view');

  setText('v-initials', initials(client.name));
  setText('v-name', client.name);
  setText('v-pan-sub', `PAN ${client.pan}`);
  const access = $('v-access');
  access.textContent = client.hasPin ? 'PIN protected' : 'PIN not set';
  access.className = `badge ${client.hasPin ? 'badge-lock' : 'badge-warn'}`;

  setText('v-name-dd', client.name);
  setText('v-period', periodLabel(client.itrPeriod));
  setText('v-phone', formatPhone(client.phone));
  setText('v-email', client.email || '—');
  setText('v-address', client.address || '—');
  setText('v-pan', client.pan);
  setText('v-gstin', client.gstin || '—');
  setText('v-bank', client.bankName || '—');
  setText('v-holder', client.accountHolder || '—');
  setText('v-ifsc', client.ifsc || '—');
  renderAccount();

  setText(
    'pin-status',
    client.hasPin
      ? 'This client is protected. The PIN is asked for every time the client is opened.'
      : 'No PIN set. A new PIN must be set the next time this client is opened.',
  );
  $('set-pin-btn').querySelector('.btn-text').textContent = client.hasPin ? 'Change PIN' : 'Set PIN';
  $('remove-pin-btn').hidden = !client.hasPin;
  setText('v-meta', `Added ${formatDate(client.createdAt)}  ·  Last updated ${formatDate(client.updatedAt)}`);
}

function renderAccount() {
  const reveal = $('reveal-account');
  reveal.hidden = !client.accountNumber;
  setText('v-account', accountShown ? client.accountNumber : maskAccount(client.accountNumber));
  reveal.textContent = accountShown ? 'Hide' : 'Show';
  reveal.setAttribute('aria-pressed', String(accountShown));
  reveal.setAttribute('aria-label', accountShown ? 'Hide account number' : 'Show account number');
}

$('reveal-account').addEventListener('click', () => {
  accountShown = !accountShown;
  renderAccount();
});

// ---------------------------------------------------------------------------
// Locked state: enter PIN, or set one first
// ---------------------------------------------------------------------------

const gateForm = $('gate-form');
const gateAlert = $('gate-alert');
const gateSubmit = gateForm.querySelector('[type="submit"]');
const gateValidator = createValidator(gateForm, { pin: validatePin });
digitsOnly(gateForm.pin);

const setForm = $('setpin-form');
const setAlert = $('setpin-alert');
const setSubmit = setForm.querySelector('[type="submit"]');
const setValidator = createValidator(setForm, { newPin: validatePin, confirmPin: confirmPinRule });
digitsOnly(setForm.newPin);
digitsOnly(setForm.confirmPin);
setForm.newPin.addEventListener('input', () => setValidator.recheck('confirmPin'));

let lockedMode = null;
let lockoutTimer;

function showLocked(mode) {
  const changed = lockedMode !== mode || $('state-locked').hidden;
  lockedMode = mode;
  showState('locked');
  setText('gate-name', client.name);
  if (!changed) return;

  const entering = mode === 'enter';
  $('gate-panel').hidden = !entering;
  $('setpin-panel').hidden = entering;

  if (entering) {
    document.title = `Enter PIN | ${client.name} | Taxora`;
    gateForm.reset();
    gateValidator.reset();
    clearAlert(gateAlert);
    setButtonState(gateSubmit, 'idle');
    updateLockout();
    if (!gateSubmit.disabled) gateForm.pin.focus();
    return;
  }

  document.title = `Set PIN | ${client.name} | Taxora`;
  setText('setpin-title', mode === 'reset' ? 'Set a new PIN' : 'Set a PIN to continue');
  setText(
    'setpin-text',
    mode === 'reset'
      ? `Account password confirmed. Choose a new 4–6 digit PIN for ${client.name}.`
      : `${client.name} doesn’t have a PIN yet. Set a 4–6 digit PIN to keep this client’s details confidential.`,
  );
  setForm.reset();
  setValidator.reset();
  clearAlert(setAlert);
  setButtonState(setSubmit, 'idle');
  setForm.newPin.focus();
}

function updateLockout() {
  clearTimeout(lockoutTimer);
  const seconds = lockoutRemaining(clientId);
  if (seconds > 0) {
    gateSubmit.disabled = true;
    gateForm.pin.disabled = true;
    showAlert(gateAlert, `Too many wrong attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`);
    lockoutTimer = setTimeout(updateLockout, 1000);
  } else if (gateForm.pin.disabled) {
    gateSubmit.disabled = false;
    gateForm.pin.disabled = false;
    clearAlert(gateAlert);
    gateForm.pin.focus();
  }
}

gateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert(gateAlert);
  if (lockoutRemaining(clientId) > 0) return updateLockout();
  if (!gateValidator.validate()) return;

  setButtonState(gateSubmit, 'loading');
  try {
    if (await checkClientPin(client, gateForm.pin.value)) {
      unlockClient(clientId);
      setButtonState(gateSubmit, 'success');
      setTimeout(render, 350);
      return;
    }
    const left = recordFailedAttempt(clientId);
    setButtonState(gateSubmit, 'idle');
    gateForm.pin.value = '';
    if (left === 0) {
      updateLockout();
    } else {
      showAlert(gateAlert, `Incorrect PIN. ${left} attempt${left === 1 ? '' : 's'} left.`);
      gateForm.pin.focus();
    }
  } catch (error) {
    setButtonState(gateSubmit, 'idle');
    showAlert(gateAlert, friendlyError(error));
  }
});

setForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAlert(setAlert);
  if (!setValidator.validate()) return;

  setButtonState(setSubmit, 'loading');
  const wasReset = resetVerified;
  try {
    // Unlock first, so the live update that follows the save opens the client.
    unlockClient(clientId);
    resetVerified = false;
    await setClientPin(uid, clientId, setForm.newPin.value);
    clearAttempts(clientId);
    setButtonState(setSubmit, 'success');
    showToast(wasReset ? 'New PIN set' : 'PIN set');
    setTimeout(render, 350);
  } catch (error) {
    lockClient(clientId);
    resetVerified = wasReset;
    setButtonState(setSubmit, 'idle');
    showAlert(setAlert, friendlyError(error));
  }
});

// Forgot PIN: confirm the account password, then choose a new PIN.
function setupForgotPin() {
  const dialog = setupDialog($('forgot-dialog'));
  const form = $('forgot-form');
  const alert = $('forgot-alert');
  const submit = form.querySelector('[type="submit"]');
  const validator = createValidator(form, { password: validateSignInPassword });

  $('forgot-pin').addEventListener('click', () => {
    form.reset();
    validator.reset();
    clearAlert(alert);
    setButtonState(submit, 'idle');
    openDialog(dialog, '#forgot-password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!validator.validate()) return;

    setButtonState(submit, 'loading');
    setDialogBusy(dialog, true);
    try {
      await confirmAccountPassword(form.password.value);
      clearAttempts(clientId);
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        resetVerified = true;
        render();
      }, 400);
    } catch (error) {
      setDialogBusy(dialog, false);
      setButtonState(submit, 'idle');
      showAlert(alert, WRONG_PASSWORD.has(error?.code) ? 'Password is incorrect.' : friendlyError(error));
      form.password.value = '';
      form.password.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Edit client
// ---------------------------------------------------------------------------

function setupEditClient() {
  const dialog = setupDialog($('client-dialog'));
  const form = $('client-form');
  const alert = $('client-form-alert');
  const submit = form.querySelector('[type="submit"]');
  const clientForm = mountClientForm($('client-form-fields'), { prefix: 'ef', mode: 'edit' });

  $('edit-client-btn').addEventListener('click', () => {
    clientForm.reset();
    clientForm.fill(client);
    clearAlert(alert);
    setButtonState(submit, 'idle');
    openDialog(dialog, '#ef-name');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!clientForm.validator.validate()) return;

    const details = clientForm.values();
    setButtonState(submit, 'loading');
    setDialogBusy(dialog, true);
    try {
      if (details.pan !== client.pan) {
        const duplicate = await findClientByPan(uid, details.pan, clientId);
        if (duplicate) {
          setDialogBusy(dialog, false);
          setButtonState(submit, 'idle');
          clientForm.setError('pan', `${duplicate.name} already uses this PAN.`);
          return;
        }
      }
      await updateClient(uid, clientId, details);
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        showToast('Client details saved');
      }, 450);
    } catch (error) {
      setDialogBusy(dialog, false);
      setButtonState(submit, 'idle');
      showAlert(alert, friendlyError(error));
    }
  });
}

// ---------------------------------------------------------------------------
// Set / change / remove PIN (from the open client)
// ---------------------------------------------------------------------------

function setupPinDialog() {
  const dialog = setupDialog($('pin-dialog'));
  const form = $('pin-form');
  const alert = $('pin-alert');
  const submit = $('pin-submit');
  [form.currentPin, form.newPin, form.confirmPin].forEach(digitsOnly);
  let mode = 'set';

  // Separate validators so hidden fields never block the visible ones.
  const newValidator = createValidator(form, { newPin: validatePin, confirmPin: confirmPinRule });
  const currentValidator = createValidator(form, { currentPin: validateCurrentPin });
  form.newPin.addEventListener('input', () => newValidator.recheck('confirmPin'));

  const copy = {
    set: { title: 'Set PIN', text: 'Choose a 4–6 digit PIN. It will be asked for every time this client is opened.', button: 'Set PIN', done: 'PIN set' },
    change: { title: 'Change PIN', text: 'Enter the current PIN, then choose a new 4–6 digit PIN.', button: 'Save new PIN', done: 'PIN changed' },
    remove: {
      title: 'Remove PIN',
      text: 'The next time this client is opened, a new PIN must be set before its details are shown. Enter the current PIN to confirm.',
      button: 'Remove PIN',
      done: 'PIN removed. A new PIN will be needed next time.',
    },
  };

  function open(nextMode) {
    mode = nextMode;
    form.reset();
    newValidator.reset();
    currentValidator.reset();
    form.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
    clearAlert(alert);
    const c = copy[mode];
    setText('pin-dialog-title', c.title);
    setText('pin-dialog-text', c.text);
    submit.querySelector('.btn-text').textContent = c.button;
    submit.dataset.label = c.button;
    submit.dataset.doneLabel = mode === 'remove' ? 'PIN removed' : c.done;
    submit.classList.toggle('btn-danger', mode === 'remove');
    submit.classList.toggle('btn-primary', mode !== 'remove');
    form.querySelector('[data-for="current"]').hidden = mode === 'set';
    form.querySelectorAll('[data-for="new"]').forEach((field) => {
      field.hidden = mode === 'remove';
    });
    setButtonState(submit, 'idle');
    openDialog(dialog, mode === 'set' ? '#pin-new' : '#pin-current');
  }

  $('set-pin-btn').addEventListener('click', () => open(client.hasPin ? 'change' : 'set'));
  $('remove-pin-btn').addEventListener('click', () => open('remove'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    const needsCurrent = mode !== 'set';
    const needsNew = mode !== 'remove';
    const currentOk = needsCurrent ? currentValidator.validate() : true;
    const newOk = needsNew ? newValidator.validate() : true;
    if (!currentOk || !newOk) return;

    setButtonState(submit, 'loading');
    setDialogBusy(dialog, true);
    try {
      if (needsCurrent) {
        if (lockoutRemaining(clientId) > 0) throw Object.assign(new Error('locked'), { pinLocked: true });
        if (!(await checkClientPin(client, form.currentPin.value))) {
          const left = recordFailedAttempt(clientId);
          setDialogBusy(dialog, false);
          setButtonState(submit, 'idle');
          form.currentPin.value = '';
          form.currentPin.focus();
          showAlert(
            alert,
            left === 0
              ? `Too many wrong attempts. Try again in ${lockoutRemaining(clientId)} seconds.`
              : `Current PIN is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.`,
          );
          return;
        }
        clearAttempts(clientId);
      }

      if (mode === 'remove') {
        // Stay open for now; the next visit will ask for a new PIN.
        keepOpenWithoutPin = true;
        await removeClientPin(uid, clientId);
        lockClient(clientId);
      } else {
        unlockClient(clientId);
        await setClientPin(uid, clientId, form.newPin.value);
      }

      const done = copy[mode].done;
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        showToast(done);
      }, 450);
    } catch (error) {
      if (mode === 'remove') keepOpenWithoutPin = false;
      setDialogBusy(dialog, false);
      setButtonState(submit, 'idle');
      showAlert(
        alert,
        error.pinLocked ? `Too many wrong attempts. Try again in ${lockoutRemaining(clientId)} seconds.` : friendlyError(error),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Delete client: step 1 warning → step 2 type the client's name
// ---------------------------------------------------------------------------

function setupDelete() {
  const dialog = setupDialog($('delete-dialog'));
  const step1 = $('delete-step-1');
  const step2 = $('delete-step-2');
  const input = $('delete-confirm-input');
  const alert = $('delete-alert');
  const confirmButton = $('confirm-delete');
  const nameMatches = () => input.value.trim() === client.name;

  function showStep(step) {
    step1.hidden = step !== 1;
    step2.hidden = step !== 2;
    setText('delete-dialog-title', step === 1 ? 'Delete this client?' : 'Confirm deletion');
    if (step === 1) {
      // Focus Cancel first, so Enter doesn't move ahead by accident.
      step1.querySelector('[data-close]').focus();
    } else {
      input.value = '';
      input.closest('.field').classList.remove('has-error');
      clearAlert(alert);
      setButtonState(confirmButton, 'idle');
      confirmButton.disabled = true;
      input.focus();
    }
  }

  $('delete-client-btn').addEventListener('click', () => {
    dialog.querySelectorAll('.delete-name').forEach((el) => {
      el.textContent = client.name;
    });
    openDialog(dialog, '#delete-step-1 [data-close]');
    showStep(1);
  });

  $('delete-continue').addEventListener('click', () => showStep(2));
  $('delete-back').addEventListener('click', () => showStep(1));

  input.addEventListener('input', () => {
    confirmButton.disabled = !nameMatches();
    if (nameMatches()) input.closest('.field').classList.remove('has-error');
  });
  // Prevent pasting the name in, so it's typed deliberately.
  input.addEventListener('paste', (event) => event.preventDefault());

  step2.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!nameMatches()) {
      const span = $('delete-confirm-input-error').querySelector('span');
      span.textContent = 'The name doesn’t match. Type it exactly as shown.';
      input.closest('.field').classList.add('has-error');
      input.focus();
      return;
    }

    setButtonState(confirmButton, 'loading');
    setDialogBusy(dialog, true);
    $('delete-back').disabled = true;
    const name = client.name;
    try {
      stopWatching?.();
      await deleteClient(uid, clientId);
      lockClient(clientId);
      clearAttempts(clientId);
      setFlash({ type: 'client-deleted', name });
      succeed(confirmButton, () => window.location.replace('/dashboard'), 500);
    } catch (error) {
      setDialogBusy(dialog, false);
      $('delete-back').disabled = false;
      setButtonState(confirmButton, 'idle');
      confirmButton.disabled = !nameMatches();
      showAlert(alert, friendlyError(error));
      startWatching();
    }
  });
}

// ---------------------------------------------------------------------------

let stopWatching;
function startWatching() {
  stopWatching = watchClient(
    uid,
    clientId,
    (data) => {
      client = data;
      render();
    },
    (error) => {
      showState('missing');
      showAlert($('client-alert'), friendlyError(error));
    },
  );
}

async function main() {
  const user = await requireUser();
  if (!user) return;
  uid = user.uid;
  setText('topbar-user', user.displayName || user.email);

  clientId = new URLSearchParams(window.location.search).get('id');
  revealPage();

  if (!clientId || !/^[A-Za-z0-9_-]{1,128}$/.test(clientId)) {
    showState('missing');
    return;
  }

  setupForgotPin();
  setupEditClient();
  setupPinDialog();
  setupDelete();
  startWatching();

  $('logout-client-btn').addEventListener('click', () => {
    lockClient(clientId);
    goToDashboard();
  });

  const signOutButton = $('signout');
  signOutButton.addEventListener('click', async () => {
    setBusy(signOutButton, true);
    try {
      lockAllClients();
      await logOut();
      succeed(signOutButton, () => window.location.replace('/'), 400);
    } catch (error) {
      showAlert($('client-alert'), friendlyError(error));
      setBusy(signOutButton, false);
    }
  });
}

main();
