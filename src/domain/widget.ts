/**
 * The data the home-screen widget and the screensaver draw from — pure, no RN. The widget has no
 * access to this app's JavaScript, so it gets a small JSON payload covering the
 * next few days and works out "today" and "next prayer" itself, which keeps the
 * countdown correct while the app is closed.
 */

import { addDays, formatClock, toDateKey } from './date';
import { formatHijri, hijriFor } from './hijri';
import { HORIZON_DAYS } from './plan';
import { KEY_DATES } from './keyDates';
import { upcomingPrayers } from './times';
import type { LocationSettings } from './types';

export interface WidgetPayload {
  /** 'yyyy-mm-dd' → [Gregorian text, Hijri text]. */
  days: Record<string, [string, string]>;
  /** [name, epoch milliseconds, clock text], in time order. */
  prayers: [string, number, string][];
  /** Key Islamic dates from today on: [yyyy-mm-dd, name]. The screensaver shows one on its day. */
  events: [string, string][];
}

export function gregorianLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildWidgetPayload(now: Date, location: LocationSettings, days = HORIZON_DAYS): WidgetPayload {
  const today = toDateKey(now);
  const dayMap: WidgetPayload['days'] = {};
  for (let i = 0; i < days; i++) {
    const key = addDays(today, i);
    const [y, m, d] = key.split('-').map(Number);
    dayMap[key] = [gregorianLabel(new Date(y, m - 1, d)), formatHijri(hijriFor(key))];
  }
  const prayers = upcomingPrayers(now, days, location).map(
    (p): [string, number, string] => [p.name, p.time.getTime(), formatClock(p.time)],
  );
  const events = KEY_DATES.filter((k) => k.date >= today).map((k): [string, string] => [k.date, k.name]);
  return { days: dayMap, prayers, events };
}
