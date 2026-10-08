const pad = (n: number) => String(n).padStart(2, '0');

/** 'yyyy-mm-dd' in the device's local calendar. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** The instant 'HH:MM' falls on a given local day. */
export function atTime(key: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const date = fromDateKey(key);
  date.setHours(h, m, 0, 0);
  return date;
}

export function formatClock(date: Date): string {
  const h = date.getHours();
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(date.getMinutes())} ${suffix}`;
}

/** '1h 12m' or '45m', rounded up like the Mac menu bar. */
export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
