/** "2025-26" → "FY 2025-26 (AY 2026-27)" */
export function periodLabel(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? '');
  if (!match) return period || '—';
  const start = Number(match[1]);
  const ay = `${start + 1}-${String((start + 2) % 100).padStart(2, '0')}`;
  return `FY ${period} (AY ${ay})`;
}

/** Short form for lists: "FY 2025-26" */
export const periodShort = (period) => (period ? `FY ${period}` : '—');

/** Financial years for the ITR period picker, newest first. Default is the last completed FY. */
export function itrPeriods(now = new Date()) {
  const currentStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const periods = [];
  for (let start = currentStart; start >= currentStart - 7; start -= 1) {
    periods.push(`${start}-${String((start + 1) % 100).padStart(2, '0')}`);
  }
  return { periods, defaultPeriod: periods[1] };
}

/** "9876543210" → "+91 98765 43210" */
export const formatPhone = (phone) => (phone?.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : phone || '—');

/** "123456789012" → "•••• 9012" */
export const maskAccount = (account) => (account ? `•••• ${account.slice(-4)}` : '—');

export const initials = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (timestamp) => (timestamp?.toDate ? dateFormat.format(timestamp.toDate()) : '—');
