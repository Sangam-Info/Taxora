import { getProfile, syncProfile, logOut } from '../services/auth.js';
import { watchClients, createClient } from '../services/clients.js';
import { requireUser } from '../services/session.js';
import { friendlyError } from '../lib/errors.js';
import { takeFlash } from '../lib/flash.js';
import { lockAllClients, unlockClient } from '../lib/client-session.js';
import { mountClientForm } from '../lib/client-form.js';
import { setupDialog, openDialog, closeDialog, setDialogBusy } from '../lib/dialog.js';
import { showToast } from '../lib/toast.js';
import { formatDate, formatPhone, periodShort, initials } from '../lib/format.js';
import { setBusy, setButtonState, succeed, showAlert, clearAlert, revealPage } from '../lib/ui.js';

const $ = (id) => document.getElementById(id);
const setText = (id, value) => {
  $(id).textContent = value;
};

async function loadProfile(user) {
  let profile = await getProfile(user.uid);
  if (!profile) {
    await syncProfile(user);
    profile = await getProfile(user.uid);
  }
  return profile;
}

function renderProfile(user, profile) {
  const name = profile?.fullName || user.displayName || 'there';
  setText('welcome', `Welcome, ${name.split(' ')[0]}`);
  setText('topbar-user', profile?.fullName || user.displayName || user.email);
  setText('d-name', profile?.fullName || user.displayName || '—');
  setText('d-email', user.email);
  setText('d-created', formatDate(profile?.createdAt));
  setText('d-last', formatDate(profile?.lastLoginAt));
}

// ---------------------------------------------------------------------------
// Client list
// ---------------------------------------------------------------------------

const list = $('client-list');
const rowTemplate = $('client-row-tpl');
const search = $('client-search');
let clients = [];
let loaded = false;

const matches = (client, term) =>
  [client.name, client.pan, client.gstin, client.phone, client.email].some((value) =>
    (value || '').toLowerCase().includes(term),
  );

function buildRow(client) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  const link = row.querySelector('a');
  link.href = `/client?id=${encodeURIComponent(client.id)}`;
  link.setAttribute('aria-label', `Open ${client.name} (${client.hasPin ? 'PIN protected' : 'PIN not set'})`);
  const set = (key, value) => {
    row.querySelector(`[data-f="${key}"]`).textContent = value;
  };
  set('initials', initials(client.name));
  set('name', client.name);
  set('phone', formatPhone(client.phone));
  set('pan', client.pan);
  set('gstin', client.gstin || '—');
  set('period', periodShort(client.itrPeriod));
  const badge = row.querySelector('[data-f="access"]');
  badge.textContent = client.hasPin ? 'PIN protected' : 'PIN not set';
  badge.classList.add(client.hasPin ? 'badge-lock' : 'badge-warn');
  return row;
}

function renderClients() {
  if (!loaded) return;
  const term = search.value.trim().toLowerCase();
  const visible = term ? clients.filter((client) => matches(client, term)) : clients;

  list.replaceChildren(...visible.map(buildRow));
  list.setAttribute('aria-busy', 'false');
  search.disabled = clients.length === 0;

  const count = clients.length;
  setText('client-count', count === 0 ? 'No clients yet' : `${count} client${count === 1 ? '' : 's'}`);
  $('clients-empty').hidden = count !== 0;
  document.querySelector('.client-head').hidden = visible.length === 0;
  $('clients-noresults').hidden = !(count > 0 && visible.length === 0);
  setText('noresults-term', search.value.trim());
}

search.addEventListener('input', renderClients);

// Shorter placeholder on narrow screens so it isn't cut off.
const narrow = window.matchMedia('(max-width: 420px)');
const setPlaceholder = () => {
  search.placeholder = narrow.matches ? 'Search clients' : 'Search name, PAN, GSTIN or phone';
};
narrow.addEventListener('change', setPlaceholder);
setPlaceholder();

// ---------------------------------------------------------------------------
// Add client
// ---------------------------------------------------------------------------

function setupAddClient(uid) {
  const dialog = setupDialog($('client-dialog'));
  const form = $('client-form');
  const alert = $('client-form-alert');
  const submit = form.querySelector('[type="submit"]');
  const clientForm = mountClientForm($('client-form-fields'), { prefix: 'cf', mode: 'add' });

  const open = () => {
    clientForm.reset();
    clearAlert(alert);
    setButtonState(submit, 'idle');
    openDialog(dialog, '#cf-name');
  };
  $('add-client-btn').addEventListener('click', open);
  $('empty-add-btn').addEventListener('click', open);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alert);
    if (!clientForm.validator.validate()) return;

    const details = clientForm.values();
    const duplicate = clients.find((client) => client.pan === details.pan);
    if (duplicate) {
      clientForm.setError('pan', `${duplicate.name} already uses this PAN.`);
      return;
    }

    setButtonState(submit, 'loading');
    setDialogBusy(dialog, true);
    try {
      const pin = clientForm.pin();
      const id = await createClient(uid, details, pin);
      // You just chose this PIN, so the new client opens without asking for it.
      if (pin) unlockClient(id);
      setButtonState(submit, 'success');
      setTimeout(() => {
        setDialogBusy(dialog, false);
        closeDialog(dialog);
        showToast(`${details.name} added`);
      }, 500);
    } catch (error) {
      setDialogBusy(dialog, false);
      setButtonState(submit, 'idle');
      showAlert(alert, friendlyError(error));
    }
  });
}

// ---------------------------------------------------------------------------

async function main() {
  const user = await requireUser();
  if (!user) return;

  const alert = $('dash-alert');
  let profile = null;
  try {
    profile = await loadProfile(user);
  } catch (error) {
    showAlert(alert, friendlyError(error));
  }
  renderProfile(user, profile);
  revealPage();

  const flash = takeFlash();
  if (flash?.type === 'client-deleted') showToast(`${flash.name} deleted`);

  watchClients(
    user.uid,
    (data) => {
      clients = data;
      loaded = true;
      renderClients();
    },
    (error) => {
      list.replaceChildren();
      list.setAttribute('aria-busy', 'false');
      setText('client-count', 'Couldn’t load clients');
      showAlert(alert, friendlyError(error));
    },
  );

  setupAddClient(user.uid);

  const signOutButton = $('signout');
  signOutButton.addEventListener('click', async () => {
    setBusy(signOutButton, true);
    try {
      lockAllClients();
      await logOut();
      succeed(signOutButton, () => window.location.replace('/'), 400);
    } catch (error) {
      showAlert(alert, friendlyError(error));
      setBusy(signOutButton, false);
    }
  });
}

main();
