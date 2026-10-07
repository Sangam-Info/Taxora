let region;

function getRegion() {
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}

/** Short confirmation in the corner, e.g. "Client added". */
export function showToast(message, tone = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  getRegion().append(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
  }, 3200);
}
