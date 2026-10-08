/**
 * Key Islamic dates for 2026 and 2027 — pure, no RN. Copied from MUIS's
 * "Key Islamic dates" PDFs (muis.gov.sg/resources/islamic-calendar); tests
 * check each against the Hijri calendar in hijri.ts so the two can't drift.
 */

import { atTime, toDateKey } from './date';

export interface KeyDate {
  /** Gregorian date, 'yyyy-mm-dd'. */
  date: string;
  name: string;
  /** As MUIS prints it, e.g. '10 Zulhijjah 1447H'. */
  hijri: string;
}

export const KEY_DATES: readonly KeyDate[] = [
  { date: '2026-01-17', name: 'Israk Mikraj', hijri: '27 Rejab 1447H' },
  { date: '2026-02-03', name: 'Nisfu Syaaban', hijri: '15 Syaaban 1447H' },
  { date: '2026-02-19', name: 'Beginning of Fasting', hijri: '1 Ramadan 1447H' },
  { date: '2026-03-07', name: 'Nuzul Quran', hijri: '17 Ramadan 1447H' },
  { date: '2026-03-21', name: 'Hari Raya Aidilfitri', hijri: '1 Syawal 1447H' },
  { date: '2026-05-27', name: 'Hari Raya Aidiladha', hijri: '10 Zulhijjah 1447H' },
  { date: '2026-06-17', name: 'Islamic New Year', hijri: '1 Muharram 1448H' },
  { date: '2026-06-26', name: 'Asyura Day', hijri: '10 Muharram 1448H' },
  { date: '2026-08-25', name: "Prophet Muhammad's Birthday", hijri: '12 Rabiulawal 1448H' },
  { date: '2027-01-06', name: 'Israk Mikraj', hijri: '27 Rejab 1448H' },
  { date: '2027-01-24', name: 'Nisfu Syaaban', hijri: '15 Syaaban 1448H' },
  { date: '2027-02-08', name: 'Beginning of Fasting', hijri: '1 Ramadan 1448H' },
  { date: '2027-02-24', name: 'Nuzul Quran', hijri: '17 Ramadan 1448H' },
  { date: '2027-03-10', name: 'Hari Raya Aidilfitri', hijri: '1 Syawal 1448H' },
  { date: '2027-05-17', name: 'Hari Raya Aidiladha', hijri: '10 Zulhijjah 1448H' },
  { date: '2027-06-06', name: 'Islamic New Year', hijri: '1 Muharram 1449H' },
  { date: '2027-06-15', name: 'Asyura Day', hijri: '10 Muharram 1449H' },
  { date: '2027-08-15', name: "Prophet Muhammad's Birthday", hijri: '12 Rabiulawal 1449H' },
];

/** Whole days from `fromKey` to `toKey` (negative if in the past), immune to daylight saving. */
export function daysUntil(fromKey: string, toKey: string): number {
  const a = atTime(fromKey, '12:00');
  const b = atTime(toKey, '12:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** The next `count` key dates falling today or later. */
export function upcomingKeyDates(now: Date, count: number): KeyDate[] {
  const today = toDateKey(now);
  return KEY_DATES.filter((k) => k.date >= today).slice(0, count);
}

/** 'Today', 'Tomorrow' or 'in 12 days'. */
export function whenLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}
