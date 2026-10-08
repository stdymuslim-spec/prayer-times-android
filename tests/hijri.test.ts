import { describe, expect, it } from 'vitest';

import { addDays, toDateKey } from '../src/domain/date';
import {
  formatHijri,
  hijriFor,
  MUIS_FIRST_DAY,
  MUIS_LAST_DAY,
  muisHijriFor,
  tabularHijriFor,
  umalquraHijriFor,
} from '../src/domain/hijri';
import fixture from './fixtures/muis-days.json';

const MUIS = fixture as Record<string, number>;

describe('muisHijriFor (MUIS Islamic calendar 2026 and 2027)', () => {
  it('reproduces every one of the 730 published MUIS days', () => {
    const days = Object.keys(MUIS).sort();
    expect(days).toHaveLength(730);
    expect(days[0]).toBe(MUIS_FIRST_DAY);
    expect(days.at(-1)).toBe(MUIS_LAST_DAY);
    const mismatches = days.filter((d) => muisHijriFor(d).day !== MUIS[d]);
    expect(mismatches).toEqual([]);
    expect(days.every((d) => muisHijriFor(d).official)).toBe(true);
  });

  it('matches the dates MUIS marks', () => {
    expect(formatHijri(muisHijriFor('2026-01-01'))).toBe('11 Rejab 1447H');
    expect(formatHijri(muisHijriFor('2026-02-19'))).toBe('1 Ramadan 1447H'); // first day of Ramadan
    expect(formatHijri(muisHijriFor('2026-03-21'))).toBe('1 Syawal 1447H'); // Eidulfitri
    expect(formatHijri(muisHijriFor('2026-05-27'))).toBe('10 Zulhijjah 1447H'); // Eiduladha
    expect(formatHijri(muisHijriFor('2026-06-17'))).toBe('1 Muharram 1448H');
    expect(formatHijri(muisHijriFor('2026-10-08'))).toBe('26 Rabiulakhir 1448H');
    expect(formatHijri(muisHijriFor('2026-12-31'))).toBe('21 Rejab 1448H');
    expect(formatHijri(muisHijriFor('2027-12-31'))).toBe('2 Syaaban 1449H');
  });

  it('flags dates outside the MUIS calendar as estimates and keeps the sequence continuous', () => {
    expect(muisHijriFor('2028-01-01').official).toBe(false);
    expect(muisHijriFor('2025-12-31').official).toBe(false);
    // Day-by-day across the end of the published range: +1, or a new month starting at 1.
    let prev = muisHijriFor('2027-12-15');
    for (let i = 1; i <= 120; i++) {
      const key = addDays('2027-12-15', i);
      const cur = muisHijriFor(key);
      expect(cur.day === prev.day + 1 || (cur.day === 1 && [29, 30].includes(prev.day))).toBe(true);
      prev = cur;
    }
    expect(formatHijri(muisHijriFor('2028-01-01'))).toBe('3 Syaaban 1449H');
  });

  it('rolls the year over after Zulhijjah in the estimated range', () => {
    // Roughly 1 Muharram 1450 falls in late May 2028.
    const h = muisHijriFor('2028-06-15');
    expect(h.year).toBe(1450);
    expect(h.monthName).toBe('Muharram');
    expect(toDateKey(new Date(2028, 5, 15))).toBe('2028-06-15');
  });

  it('estimates before the published range too', () => {
    expect(formatHijri(muisHijriFor('2025-12-21'))).toBe('30 Jamadilakhir 1447H');
  });
});

describe('Umm al-Qura option', () => {
  it('follows the Umm al-Qura calendar', () => {
    // 1 Ramadan 1447 and 1 Muharram 1448 under Umm al-Qura.
    expect(formatHijri(umalquraHijriFor('2026-02-18')!)).toBe('1 Ramadan 1447H');
    expect(formatHijri(umalquraHijriFor('2026-06-16')!)).toBe('1 Muharram 1448H');
  });

  it('gives a valid Hijri date for every day of 2026 to 2028', () => {
    for (let i = 0; i < 365 * 3; i++) {
      const h = umalquraHijriFor(addDays('2026-01-01', i))!;
      expect(h.day).toBeGreaterThanOrEqual(1);
      expect(h.day).toBeLessThanOrEqual(30);
      expect(h.year).toBeGreaterThanOrEqual(1447);
      expect(h.year).toBeLessThanOrEqual(1450);
    }
  });

  it('keeps the tabular fallback within two days of Umm al-Qura', () => {
    const toOrdinal = (key: string, h: { day: number; monthName: string; year: number }) => {
      const monthIdx = ['Muharram','Safar','Rabiulawal','Rabiulakhir','Jamadilawal','Jamadilakhir','Rejab','Syaaban','Ramadan','Syawal','Zulkaedah','Zulhijjah'].indexOf(h.monthName);
      return (h.year * 12 + monthIdx) * 29.53 + h.day;
    };
    for (let i = 0; i < 365; i++) {
      const key = addDays('2026-01-01', i);
      const diff = Math.abs(toOrdinal(key, umalquraHijriFor(key)!) - toOrdinal(key, tabularHijriFor(key)));
      expect(diff).toBeLessThan(3);
    }
  });
});

describe('hijriFor default', () => {
  it('follows the MUIS Islamic calendar', () => {
    expect(formatHijri(hijriFor('2026-10-08'))).toBe('26 Rabiulakhir 1448H');
    expect(formatHijri(hijriFor('2027-03-10'))).toBe('1 Syawal 1448H');
  });
});
