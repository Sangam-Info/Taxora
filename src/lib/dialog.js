/**
 * Thin wrapper around <dialog>: opens as a modal, closes on Esc / backdrop click
 * (unless busy), returns focus to the button that opened it.
 */
const openers = new WeakMap();

export function setupDialog(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && !dialog.dataset.busy) closeDialog(dialog);
  });
  dialog.addEventListener('cancel', (event) => {
    if (dialog.dataset.busy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    const opener = openers.get(dialog);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!dialog.dataset.busy) closeDialog(dialog);
    });
  });
  return dialog;
}

export function openDialog(dialog, focusSelector) {
  openers.set(dialog, document.activeElement);
  delete dialog.dataset.busy;
  document.documentElement.classList.add('modal-open');
  dialog.showModal();
  const target = focusSelector ? dialog.querySelector(focusSelector) : dialog.querySelector('input, select, textarea, button.btn');
  target?.focus();
}

export function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

/** While busy, the dialog can't be dismissed and its controls are disabled. */
export function setDialogBusy(dialog, busy) {
  if (busy) dialog.dataset.busy = 'true';
  else delete dialog.dataset.busy;
  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.disabled = busy;
  });
}
