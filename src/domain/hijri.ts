/**
 * Hijri dates — pure, no RN. `hijriFor` is what the app calls. It follows the
 * "Islamic calendar" PDFs on muis.gov.sg/resources/islamic-calendar, which
 * give the Hijri date for every day of 2026 and 2027. Umm al-Qura (through the
 * phone's ICU) is kept as an option via HIJRI_CALENDAR.
 *
 * The first day of each Hijri month in those calendars is stored below, which
 * reproduces all 730 published days (tests check it against the full tables). Outside the published range the
 * date is an estimate carried on from the nearest MUIS month by average
 * lunation length, and is flagged `official: false`; it can be a day off
 * until MUIS publishes the next calendar.
 *
 * Like the MUIS calendar, the Hijri day changes at midnight, not Maghrib.
 */

import { fromDateKey, toDateKey } from './date';

const MONTH_NAMES = [
  'Muharram',
  'Safar',
  'Rabiulawal',
  'Rabiulakhir',
  'Jamadilawal',
  'Jamadilakhir',
  'Rejab',
  'Syaaban',
  'Ramadan',
  'Syawal',
  'Zulkaedah',
  'Zulhijjah',
] as const;

interface MonthStart {
  /** Gregorian date of the 1st of the Hijri month. */
  start: string;
  /** Index into MONTH_NAMES. */
  month: number;
  year: number;
}

/**
 * First day of each Hijri month in the MUIS 2026 calendar. The first entry is
 * implied by MUIS showing 1 Jan 2026 as 11 Rejab 1447.
 */
export const MUIS_MONTH_STARTS: readonly MonthStart[] = [
  { start: '2025-12-22', month: 6, year: 1447 },
  { start: '2026-01-20', month: 7, year: 1447 },
  { start: '2026-02-19', month: 8, year: 1447 },
  { start: '2026-03-21', month: 9, year: 1447 },
  { start: '2026-04-19', month: 10, year: 1447 },
  { start: '2026-05-18', month: 11, year: 1447 },
  { start: '2026-06-17', month: 0, year: 1448 },
  { start: '2026-07-16', month: 1, year: 1448 },
  { start: '2026-08-14', month: 2, year: 1448 },
  { start: '2026-09-13', month: 3, year: 1448 },
  { start: '2026-10-12', month: 4, year: 1448 },
  { start: '2026-11-11', month: 5, year: 1448 },
  { start: '2026-12-11', month: 6, year: 1448 },
  { start: '2027-01-10', month: 7, year: 1448 },
  { start: '2027-02-08', month: 8, year: 1448 },
  { start: '2027-03-10', month: 9, year: 1448 },
  { start: '2027-04-09', month: 10, year: 1448 },
  { start: '2027-05-08', month: 11, year: 1448 },
  { start: '2027-06-06', month: 0, year: 1449 },
  { start: '2027-07-06', month: 1, year: 1449 },
  { start: '2027-08-04', month: 2, year: 1449 },
  { start: '2027-09-02', month: 3, year: 1449 },
  { start: '2027-10-02', month: 4, year: 1449 },
  { start: '2027-10-31', month: 5, year: 1449 },
  { start: '2027-11-30', month: 6, year: 1449 },
  { start: '2027-12-30', month: 7, year: 1449 },
];

/** The last Gregorian day the MUIS calendar covers. */
export const MUIS_LAST_DAY = '2027-12-31';
export const MUIS_FIRST_DAY = '2026-01-01';

/** Which calendar `hijriFor` follows. */
export const HIJRI_CALENDAR: 'umalqura' | 'muis' = 'muis';

const LUNATION_DAYS = 29.530588853;
const DAY_MS = 86_400_000;

export interface HijriDate {
  day: number;
  /** MONTH_NAMES spelling used by MUIS, e.g. 'Rabiulakhir'. */
  monthName: string;
  year: number;
  /** True when taken from the published MUIS calendar rather than estimated. */
  official: boolean;
}

/** Whole days between two date keys, immune to daylight saving. */
function daysBetween(fromKey: string, toKey: string): number {
  const a = fromDateKey(fromKey);
  const b = fromDateKey(toKey);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

function shift(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function muisHijriFor(dateKey: string): HijriDate {
  const official = dateKey >= MUIS_FIRST_DAY && dateKey <= MUIS_LAST_DAY;

  if (dateKey >= MUIS_MONTH_STARTS[0].start) {
    // Within or after the table: the latest known month start at or before the date.
    let index = MUIS_MONTH_STARTS.length - 1;
    while (MUIS_MONTH_STARTS[index].start > dateKey) index--;
    const known = MUIS_MONTH_STARTS[index];
    const sinceKnown = daysBetween(known.start, dateKey);
    if (index < MUIS_MONTH_STARTS.length - 1 || official) {
      return { day: sinceKnown + 1, monthName: MONTH_NAMES[known.month], year: known.year, official };
    }
    return estimate(known, dateKey, 1);
  }
  // Before the table: count lunations backwards from its first month.
  return estimate(MUIS_MONTH_STARTS[0], dateKey, -1);
}

/** Month-by-month estimate from an anchor month start, forwards (+1) or backwards (-1). */
function estimate(anchor: MonthStart, dateKey: string, direction: 1 | -1): HijriDate {
  const startOf = (n: number) => shift(anchor.start, Math.round(n * LUNATION_DAYS));
  let n = Math.floor(daysBetween(anchor.start, dateKey) / LUNATION_DAYS);
  while (startOf(n) > dateKey) n--;
  while (startOf(n + 1) <= dateKey) n++;
  const monthsFromAnchor = n;
  const absolute = anchor.year * 12 + anchor.month + monthsFromAnchor;
  const year = Math.floor(absolute / 12);
  const month = ((absolute % 12) + 12) % 12;
  return { day: daysBetween(startOf(n), dateKey) + 1, monthName: MONTH_NAMES[month], year, official: false };
}

/** '26 Rabiulakhir 1448H'. */
export function formatHijri(h: HijriDate): string {
  return `${h.day} ${h.monthName} ${h.year}H`;
}

/**
 * Umm al-Qura through the platform's ICU. Null when this JS engine can't do
 * the calendar (checked, because the result then silently falls back to
 * Gregorian numbers).
 */
export function umalquraHijriFor(dateKey: string): HijriDate | null {
  try {
    const noon = fromDateKey(dateKey);
    noon.setHours(12);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(noon);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const day = get('day');
    const month = get('month');
    const year = get('year');
    // A Gregorian fallback would give years around 2026, not 14xx.
    if (!Number.isFinite(day) || !(month >= 1 && month <= 12) || !(year > 1300 && year < 1700)) return null;
    return { day, monthName: MONTH_NAMES[month - 1], year, official: true };
  } catch {
    return null;
  }
}

/** Tabular Islamic (civil) calendar: dependable everywhere, within a day or two of Umm al-Qura. */
export function tabularHijriFor(dateKey: string): HijriDate {
  const [y, m, d] = dateKey.split('-').map(Number);
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  let l = jdn - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { day, monthName: MONTH_NAMES[month - 1], year, official: false };
}

export function hijriFor(dateKey: string): HijriDate {
  if (HIJRI_CALENDAR === 'muis') return muisHijriFor(dateKey);
  return umalquraHijriFor(dateKey) ?? tabularHijriFor(dateKey);
}
