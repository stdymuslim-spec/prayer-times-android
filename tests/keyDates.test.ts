import { describe, expect, it } from 'vitest';

import { atTime } from '../src/domain/date';
import { formatHijri, muisHijriFor } from '../src/domain/hijri';
import { daysUntil, KEY_DATES, upcomingKeyDates, whenLabel } from '../src/domain/keyDates';

describe('KEY_DATES', () => {
  it('lists 9 events for each of 2026 and 2027, in date order', () => {
    expect(KEY_DATES).toHaveLength(18);
    const dates = KEY_DATES.map((k) => k.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates.filter((d) => d.startsWith('2026'))).toHaveLength(9);
    expect(dates.filter((d) => d.startsWith('2027'))).toHaveLength(9);
  });

  it('agrees with the MUIS Hijri calendar on every date', () => {
    const mismatches = KEY_DATES.filter((k) => formatHijri(muisHijriFor(k.date)) !== k.hijri).map((k) => k.date);
    expect(mismatches).toEqual([]);
  });
});

describe('upcomingKeyDates', () => {
  it('starts from today and takes the next ones', () => {
    const next = upcomingKeyDates(atTime('2026-10-08', '10:00'), 2);
    expect(next.map((k) => k.name)).toEqual(['Israk Mikraj', 'Nisfu Syaaban']);
    expect(next[0].date).toBe('2027-01-06');
  });

  it('includes an event happening today', () => {
    expect(upcomingKeyDates(atTime('2026-05-27', '23:00'), 1)[0].name).toBe('Hari Raya Aidiladha');
  });

  it('runs out after the last bundled date', () => {
    expect(upcomingKeyDates(atTime('2027-12-01', '10:00'), 3)).toEqual([]);
  });
});

describe('daysUntil / whenLabel', () => {
  it('counts whole days across month ends', () => {
    expect(daysUntil('2026-10-08', '2026-10-09')).toBe(1);
    expect(daysUntil('2026-10-08', '2027-01-06')).toBe(90);
    expect(daysUntil('2026-10-08', '2026-10-08')).toBe(0);
  });
  it('words it', () => {
    expect(whenLabel(0)).toBe('Today');
    expect(whenLabel(1)).toBe('Tomorrow');
    expect(whenLabel(12)).toBe('in 12 days');
  });
});
