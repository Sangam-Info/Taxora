import { createValidator } from './ui.js';
import { itrPeriods, periodLabel } from './format.js';
import {
  upper,
  normalizePhone,
  validateClientName,
  validateItrPeriod,
  validateAddress,
  validatePhone,
  validateOptionalEmail,
  validatePan,
  validateGstin,
  validateAccountNumber,
  validateIfsc,
  validateOptionalText,
  validateOptionalPin,
  validatePinConfirm,
} from './validation.js';

const errorBox = (id) => `<div class="field-error" id="${id}-error" aria-live="polite"><span></span></div>`;

function field({ id, name, label, optional = false, hint = '', control, wide = false }) {
  const describedBy = [hint && `${id}-hint`, `${id}-error`].filter(Boolean).join(' ');
  return `
    <div class="field${wide ? ' span-2' : ''}">
      <label for="${id}">${label}${optional ? ' <span class="optional">(optional)</span>' : ''}</label>
      <div class="control control-plain">${control(describedBy)}</div>
      ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
      ${errorBox(id)}
    </div>`;
}

const input = (id, name, attrs = '') => (describedBy) =>
  `<input id="${id}" name="${name}" aria-describedby="${describedBy}" ${attrs} />`;

/**
 * Renders the client form into `container` and wires validation.
 * mode "add" includes the optional PIN fields; "edit" doesn't (PINs have their own dialog).
 */
export function mountClientForm(container, { prefix, mode }) {
  const p = (suffix) => `${prefix}-${suffix}`;
  const { periods, defaultPeriod } = itrPeriods();

  container.innerHTML = `
    <fieldset class="form-section">
      <legend>Client details</legend>
      <div class="form-grid">
        ${field({ id: p('name'), name: 'name', label: 'Client name', wide: true, control: input(p('name'), 'name', 'type="text" maxlength="120" autocomplete="off" required') })}
        ${field({
          id: p('period'),
          name: 'itrPeriod',
          label: 'ITR period',
          control: (d) =>
            `<select id="${p('period')}" name="itrPeriod" aria-describedby="${d}" required>${periods
              .map((period) => `<option value="${period}"${period === defaultPeriod ? ' selected' : ''}>${periodLabel(period)}</option>`)
              .join('')}</select>`,
        })}
        ${field({ id: p('phone'), name: 'phone', label: 'Phone number', control: input(p('phone'), 'phone', 'type="tel" inputmode="tel" maxlength="16" placeholder="98765 43210" autocomplete="off" required') })}
        ${field({ id: p('email'), name: 'email', label: 'Email', optional: true, wide: true, control: input(p('email'), 'email', 'type="email" inputmode="email" maxlength="254" spellcheck="false" placeholder="client@company.com" autocomplete="off"') })}
        ${field({
          id: p('address'),
          name: 'address',
          label: 'Address',
          wide: true,
          control: (d) => `<textarea id="${p('address')}" name="address" rows="3" maxlength="300" aria-describedby="${d}" required></textarea>`,
        })}
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Tax IDs</legend>
      <div class="form-grid">
        ${field({ id: p('pan'), name: 'pan', label: 'PAN', control: input(p('pan'), 'pan', 'type="text" class="caps" maxlength="10" autocapitalize="characters" spellcheck="false" placeholder="ABCDE1234F" autocomplete="off" required') })}
        ${field({ id: p('gstin'), name: 'gstin', label: 'GST number', optional: true, control: input(p('gstin'), 'gstin', 'type="text" class="caps" maxlength="15" autocapitalize="characters" spellcheck="false" placeholder="24ABCDE1234F1Z5" autocomplete="off"') })}
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Bank account <span class="optional">(optional)</span></legend>
      <div class="form-grid">
        ${field({ id: p('bank'), name: 'bankName', label: 'Bank name', control: input(p('bank'), 'bankName', 'type="text" maxlength="100" placeholder="State Bank of India" autocomplete="off"') })}
        ${field({ id: p('holder'), name: 'accountHolder', label: 'Account holder name', control: input(p('holder'), 'accountHolder', 'type="text" maxlength="120" autocomplete="off"') })}
        ${field({ id: p('account'), name: 'accountNumber', label: 'A/C number', control: input(p('account'), 'accountNumber', 'type="text" inputmode="numeric" maxlength="22" spellcheck="false" autocomplete="off"') })}
        ${field({ id: p('ifsc'), name: 'ifsc', label: 'IFSC', control: input(p('ifsc'), 'ifsc', 'type="text" class="caps" maxlength="11" autocapitalize="characters" spellcheck="false" placeholder="SBIN0001234" autocomplete="off"') })}
      </div>
    </fieldset>

    ${
      mode === 'add'
        ? `<fieldset class="form-section">
      <legend>Client PIN <span class="optional">(optional)</span></legend>
      <p class="section-hint">Protect this client with a 4–6 digit PIN. It’s asked for every time the client is opened.</p>
      <div class="form-grid">
        ${field({ id: p('pin'), name: 'pin', label: 'PIN', control: input(p('pin'), 'pin', 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="4–6 digits"') })}
        ${field({ id: p('pin2'), name: 'pinConfirm', label: 'Confirm PIN', control: input(p('pin2'), 'pinConfirm', 'type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"') })}
      </div>
    </fieldset>`
        : ''
    }`;

  const form = container.closest('form');
  const rules = {
    name: validateClientName,
    itrPeriod: validateItrPeriod,
    phone: validatePhone,
    email: validateOptionalEmail,
    address: validateAddress,
    pan: validatePan,
    gstin: (value, f) => validateGstin(value, f.pan.value),
    bankName: validateOptionalText(100, 'Bank name'),
    accountHolder: validateOptionalText(120, 'Account holder name'),
    accountNumber: (value, f) => validateAccountNumber(value, f.ifsc.value),
    ifsc: (value, f) => validateIfsc(value, f.accountNumber.value),
  };
  if (mode === 'add') {
    rules.pin = validateOptionalPin;
    rules.pinConfirm = (value, f) => validatePinConfirm(value, f.pin.value);
  }
  const validator = createValidator(form, rules);

  // Keep dependent fields in sync.
  const link = (source, ...targets) =>
    form.elements[source].addEventListener('input', () => targets.forEach((target) => validator.recheck(target)));
  link('pan', 'gstin');
  link('accountNumber', 'ifsc');
  link('ifsc', 'accountNumber');
  if (mode === 'add') link('pin', 'pinConfirm');

  // Digits only for PIN and account number as you type.
  ['pin', 'pinConfirm'].forEach((name) => {
    form.elements[name]?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
    });
  });

  return {
    validator,
    /** Cleaned values ready for Firestore. */
    values() {
      const f = form.elements;
      return {
        name: f.name.value.trim().replace(/\s+/g, ' '),
        itrPeriod: f.itrPeriod.value,
        phone: normalizePhone(f.phone.value),
        email: f.email.value.trim().toLowerCase(),
        address: f.address.value.trim(),
        pan: upper(f.pan.value),
        gstin: upper(f.gstin.value),
        bankName: f.bankName.value.trim().replace(/\s+/g, ' '),
        accountHolder: f.accountHolder.value.trim().replace(/\s+/g, ' '),
        accountNumber: f.accountNumber.value.replace(/\s+/g, ''),
        ifsc: upper(f.ifsc.value),
      };
    },
    pin: () => form.elements.pin?.value ?? '',
    fill(client) {
      const f = form.elements;
      if (client.itrPeriod && ![...f.itrPeriod.options].some((o) => o.value === client.itrPeriod)) {
        f.itrPeriod.add(new Option(periodLabel(client.itrPeriod), client.itrPeriod));
      }
      for (const key of ['name', 'itrPeriod', 'phone', 'email', 'address', 'pan', 'gstin', 'bankName', 'accountHolder', 'accountNumber', 'ifsc']) {
        f[key].value = client[key] ?? '';
      }
    },
    reset() {
      form.reset();
      validator.reset();
      form.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
    },
    /** Shows an error on one field (e.g. duplicate PAN from the server check). */
    setError(name, message) {
      const inputEl = form.elements[name];
      const span = form.querySelector(`#${inputEl.id}-error > span`);
      if (span) span.textContent = message;
      inputEl.closest('.field')?.classList.add('has-error');
      inputEl.setAttribute('aria-invalid', 'true');
      inputEl.focus();
    },
  };
}
