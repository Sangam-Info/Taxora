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

const goToDashboard = () => window.location.assign('/dashboard');

let uid;
let clientId;
let client = null;
let accountShown = false;

// ---------------------------------------------------------------------------
// States: loading → missing | gate | view
// ---------------------------------------------------------------------------

function showState(name) {
  for (const state of ['loading', 'missing', 'gate', 'view']) $(`state-${state}`).hidden = state !== name;
}

function render() {
  if (!client) {
    document.title = 'Client not found | Taxora';
    showState('missing');
    return;
  }
  document.title = `${client.name} | Taxora`;

  if (client.hasPin && !isUnlocked(clientId)) {
    showGate();
    return;
  }
  renderView();
}

function renderView() {
  showState('view');

  setText('v-initials', initials(client.name));
  setText('v-name', client.name);
  setText('v-pan-sub', `PAN ${client.pan}`);
  const access = $('v-access');
  access.textContent = client.hasPin ? 'PIN protected' : 'No PIN';
  access.className = `badge ${client.hasPin ? 'badge-lock' : 'badge-muted'}`;

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
      : 'No PIN set. Anyone signed in to your Taxora account can open this client.',
  );
  $('set-pin-btn').querySelector('.btn-text').textContent = client.hasPin ? 'Change PIN' : 'Set PIN';
  $('remove-pin-btn').hidden = !client.hasPin;
  setText('logout-client-label', client.hasPin ? 'Log out client' : 'Close client');
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
// PIN gate (client "login")
// ---------------------------------------------------------------------------

const gateForm = $('gate-form');
const gateAlert = $('gate-alert');
const gateSubmit = gateForm.querySelector('[type="submit"]');
const gateValidator = createValidator(gateForm, { pin: validatePin });
let lockoutTimer;
digitsOnly(gateForm.pin);

function showGate() {
  const firstShow = $('state-gate').hidden;
  showState('gate');
  setText('gate-name', client.name);
  if (firstShow) {
    gateForm.reset();
    gateValidator.reset();
    clearAlert(gateAlert);
    updateLockout();
    if (!gateSubmit.disabled) gateForm.pin.focus();
  }
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
      setTimeout(() => {
        setButtonState(gateSubmit, 'idle');
        renderView();
      }, 350);
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

// Forgot PIN: confirm the account password, then remove the PIN.
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
      await removeClientPin(uid, clientId);
      clearAttempts(clientId);
      unlockClient(clientId);
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        showToast('PIN removed. Set a new PIN to protect this client.');
      }, 450);
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
// Set / change / remove PIN
// ---------------------------------------------------------------------------

function setupPinDialog() {
  const dialog = setupDialog($('pin-dialog'));
  const form = $('pin-form');
  const alert = $('pin-alert');
  const submit = $('pin-submit');
  [form.currentPin, form.newPin, form.confirmPin].forEach(digitsOnly);
  let mode = 'set';

  const validators = {
    set: createValidator(form, {
      newPin: validatePin,
      confirmPin: (value, f) => validatePinConfirm(value, f.newPin.value) || (value ? '' : 'Re-enter the PIN.'),
    }),
  };
  // Separate validators so hidden fields never block the visible ones.
  const currentOnly = createValidator(form, { currentPin: validateCurrentPin });
  form.newPin.addEventListener('input', () => validators.set.recheck('confirmPin'));

  const copy = {
    set: { title: 'Set PIN', text: 'Choose a 4–6 digit PIN. It will be asked for every time this client is opened.', button: 'Set PIN', done: 'PIN set' },
    change: { title: 'Change PIN', text: 'Enter the current PIN, then choose a new 4–6 digit PIN.', button: 'Save new PIN', done: 'PIN changed' },
    remove: {
      title: 'Remove PIN',
      text: 'Without a PIN, anyone signed in to your Taxora account can open this client. Enter the current PIN to confirm.',
      button: 'Remove PIN',
      done: 'PIN removed',
    },
  };

  function open(nextMode) {
    mode = nextMode;
    form.reset();
    validators.set.reset();
    currentOnly.reset();
    form.querySelectorAll('.field').forEach((field) => field.classList.remove('has-error'));
    clearAlert(alert);
    const c = copy[mode];
    setText('pin-dialog-title', c.title);
    setText('pin-dialog-text', c.text);
    submit.querySelector('.btn-text').textContent = c.button;
    submit.dataset.label = c.button;
    submit.dataset.doneLabel = c.done;
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
    const currentOk = needsCurrent ? currentOnly.validate() : true;
    const newOk = needsNew ? validators.set.validate() : true;
    if (!currentOk || !newOk) return;

    setButtonState(submit, 'loading');
    setDialogBusy(dialog, true);
    try {
      if (needsCurrent) {
        if (lockoutRemaining(clientId) > 0) {
          throw Object.assign(new Error('locked'), { pinLocked: true });
        }
        const ok = await checkClientPin(client, form.currentPin.value);
        if (!ok) {
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

      if (mode === 'remove') await removeClientPin(uid, clientId);
      else await setClientPin(uid, clientId, form.newPin.value);
      // Keep the client open for the person who just changed its PIN.
      unlockClient(clientId);

      const done = copy[mode].done;
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        showToast(done);
      }, 450);
    } catch (error) {
      setDialogBusy(dialog, false);
      setButtonState(submit, 'idle');
      showAlert(
        alert,
        error.pinLocked
          ? `Too many wrong attempts. Try again in ${lockoutRemaining(clientId)} seconds.`
          : friendlyError(error),
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Delete client (with confirmation)
// ---------------------------------------------------------------------------

function setupDelete() {
  const dialog = setupDialog($('delete-dialog'));
  const alert = $('delete-alert');
  const confirmButton = $('confirm-delete');

  $('delete-client-btn').addEventListener('click', () => {
    setText('delete-name', client.name);
    clearAlert(alert);
    setButtonState(confirmButton, 'idle');
    // Focus Cancel first, so Enter doesn't delete by accident.
    openDialog(dialog, '[data-close].btn');
  });

  confirmButton.addEventListener('click', async () => {
    clearAlert(alert);
    setButtonState(confirmButton, 'loading');
    setDialogBusy(dialog, true);
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
      setButtonState(confirmButton, 'idle');
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
