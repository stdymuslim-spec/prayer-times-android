/**
 * Which times to show for a day: the official Singapore timetable when the
 * phone is in Singapore and the bundled year covers the date, otherwise
 * calculated for wherever the phone is.
 */

import { calculateTimes } from './calc';
import { addDays, atTime, toDateKey } from './date';
import timetable from './timetable.json';
import { distanceKm } from './travel';
import { NOTIFIED_PRAYERS, PRAYER_NAMES, SINGAPORE } from './types';
import type { DayTimes, LocationSettings, PrayerName } from './types';

const OFFICIAL = timetable as Record<string, DayTimes>;

/** The last date the bundled official timetable covers. */
export const OFFICIAL_LAST_DAY = Object.keys(OFFICIAL).sort().at(-1) ?? '';

/** Within Singapore itself: by country when known, else close to the island's centre. */
export function isInSingapore(location: LocationSettings): boolean {
  if (location.countryCode) return location.countryCode.toUpperCase() === 'SG';
  return distanceKm(location, SINGAPORE) < 30;
}

export interface DayResult {
  dateKey: string;
  times: DayTimes;
  source: 'official' | 'calculated';
}

export function timesFor(dateKey: string, location: LocationSettings): DayResult {
  const official = isInSingapore(location) ? OFFICIAL[dateKey] : undefined;
  if (official && PRAYER_NAMES.every((name) => /^\d{2}:\d{2}$/.test(official[name] ?? ''))) {
    return { dateKey, times: official, source: 'official' };
  }
  return { dateKey, times: calculateTimes(dateKey, location), source: 'calculated' };
}

export interface PrayerInstant {
  name: PrayerName;
  time: Date;
}

/** The notified prayers from today across `days` days, in order. */
export function upcomingPrayers(now: Date, days: number, location: LocationSettings): PrayerInstant[] {
  const today = toDateKey(now);
  const out: PrayerInstant[] = [];
  for (let i = 0; i < days; i++) {
    const key = addDays(today, i);
    const { times } = timesFor(key, location);
    for (const name of NOTIFIED_PRAYERS) out.push({ name, time: atTime(key, times[name]) });
  }
  return out;
}

export function nextPrayer(now: Date, location: LocationSettings): PrayerInstant | null {
  return upcomingPrayers(now, 2, location).find((p) => p.time.getTime() > now.getTime()) ?? null;
}

/** Days of official timetable left, used for the "ends soon" warning; null when not relevant. */
export function officialDaysLeft(now: Date, location: LocationSettings): number | null {
  if (!isInSingapore(location) || !OFFICIAL_LAST_DAY) return null;
  const last = atTime(OFFICIAL_LAST_DAY, '23:59');
  return Math.ceil((last.getTime() - now.getTime()) / 86_400_000);
}
