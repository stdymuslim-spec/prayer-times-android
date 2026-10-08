import { describe, expect, it } from 'vitest';

import { atTime, formatCountdown, toDateKey } from '../src/domain/date';
import { planNotifications } from '../src/domain/plan';
import { nextPrayer, OFFICIAL_LAST_DAY, officialDaysLeft, timesFor } from '../src/domain/times';
import { applyFix, describePrompt, distanceKm, methodForCountry, placeKey } from '../src/domain/travel';
import { SINGAPORE, type LocationSettings } from '../src/domain/types';

const LONDON: LocationSettings = {
  source: 'gps',
  lat: 51.5074,
  lon: -0.1278,
  label: 'London, United Kingdom',
  countryCode: 'GB',
  calculationMethod: 'MoonsightingCommittee',
};

describe('timesFor', () => {
  it('uses the official timetable in Singapore', () => {
    const day = timesFor('2026-01-01', SINGAPORE);
    expect(day.source).toBe('official');
    expect(day.times.Subuh).toBe('05:44');
    expect(day.times.Isyak).toBe('20:25');
  });

  it('calculates elsewhere', () => {
    const day = timesFor('2026-01-01', LONDON);
    expect(day.source).toBe('calculated');
    expect(day.times.Subuh).toMatch(/^\d{2}:\d{2}$/);
  });

  it('falls back to calculation after the bundled years end', () => {
    const day = timesFor('2028-03-01', SINGAPORE);
    expect(day.source).toBe('calculated');
  });

  it('calculated Singapore times land close to the official ones', () => {
    const official = timesFor('2026-08-13', SINGAPORE);
    const calc = timesFor('2026-08-13', { ...SINGAPORE, countryCode: null, lat: 1.0, lon: 104.5 });
    // Same method, nearby point: should be within a few minutes for every prayer.
    for (const name of ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'] as const) {
      const [oh, om] = official.times[name].split(':').map(Number);
      const [ch, cm] = calc.times[name].split(':').map(Number);
      expect(Math.abs(oh * 60 + om - (ch * 60 + cm))).toBeLessThan(8);
    }
  });
});

describe('nextPrayer', () => {
  it('skips Syuruk and counts down to the next of the five', () => {
    // 2026-01-01: Syuruk 07:08, Zohor 13:10
    const now = atTime('2026-01-01', '06:00');
    const next = nextPrayer(now, SINGAPORE)!;
    expect(next.name).toBe('Zohor');
    expect(next.time).toEqual(atTime('2026-01-01', '13:10'));
  });

  it('rolls over to tomorrow after Isyak', () => {
    const next = nextPrayer(atTime('2026-01-01', '23:00'), SINGAPORE)!;
    expect(next.name).toBe('Subuh');
    expect(toDateKey(next.time)).toBe('2026-01-02');
  });
});

describe('formatCountdown', () => {
  it('rounds up and switches to hours', () => {
    expect(formatCountdown(45 * 60_000 - 1)).toBe('45m');
    expect(formatCountdown(72 * 60_000)).toBe('1h 12m');
    expect(formatCountdown(-5)).toBe('0m');
  });
});

describe('planNotifications', () => {
  it('queues a reminder and a prayer notification per prayer, in order', () => {
    const now = atTime('2026-01-01', '00:00');
    const plan = planNotifications(now, SINGAPORE, 10, 1);
    expect(plan).toHaveLength(10);
    expect(plan[0]).toMatchObject({ kind: 'reminder', prayer: 'Subuh', title: '10 minutes to Subuh' });
    expect(plan[0].fireAt).toEqual(atTime('2026-01-01', '05:34'));
    expect(plan[1]).toMatchObject({ kind: 'prayer', prayer: 'Subuh', title: "It's time for Subuh." });
    expect(plan.every((p) => p.prayer !== 'Syuruk')).toBe(true);
    expect(plan.map((p) => p.fireAt.getTime())).toEqual([...plan.map((p) => p.fireAt.getTime())].sort((a, b) => a - b));
  });

  it('omits notifications already in the past, and the reminder once its time has passed', () => {
    const now = atTime('2026-01-01', '05:40'); // after the 05:34 reminder, before Subuh 05:44
    const plan = planNotifications(now, SINGAPORE, 10, 1);
    expect(plan[0]).toMatchObject({ kind: 'prayer', prayer: 'Subuh' });
    expect(plan).toHaveLength(9);
  });

  it('has unique ids', () => {
    const plan = planNotifications(atTime('2026-01-01', '00:00'), SINGAPORE, 10, 14);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
});

describe('officialDaysLeft', () => {
  it('is only reported in Singapore', () => {
    expect(OFFICIAL_LAST_DAY).toBe('2027-12-31');
    expect(officialDaysLeft(atTime('2027-12-20', '12:00'), SINGAPORE)).toBe(12);
    expect(officialDaysLeft(atTime('2027-12-20', '12:00'), LONDON)).toBeNull();
  });
});

describe('travel', () => {
  it('measures distance and picks a method per country', () => {
    expect(distanceKm(SINGAPORE, LONDON)).toBeGreaterThan(10700);
    expect(methodForCountry('SA')).toBe('UmmAlQura');
    expect(methodForCountry(null)).toBe('MuslimWorldLeague');
  });

  it('ignores small moves but follows a long trip', () => {
    const near = { lat: 1.4, lon: 103.9, label: 'Woodlands', countryCode: 'SG' };
    expect(applyFix(SINGAPORE, near)).toBeNull();
    const far = { lat: 51.5074, lon: -0.1278, label: 'London, United Kingdom', countryCode: 'GB' };
    expect(applyFix(SINGAPORE, far)).toMatchObject({
      source: 'gps',
      label: 'London, United Kingdom',
      calculationMethod: 'MoonsightingCommittee',
    });
  });

  it('applies a nearby fix when the user asked for it', () => {
    const near = { lat: 1.4, lon: 103.9, label: null, countryCode: 'SG' };
    expect(applyFix(SINGAPORE, near, { force: true })?.label).toBe('1.40, 103.90');
  });
});

describe('placeKey / describePrompt', () => {
  it('keys a place coarsely, so a few kilometres do not count as somewhere new', () => {
    expect(placeKey({ lat: 51.5, lon: -0.12, countryCode: 'GB' })).toBe(placeKey({ lat: 51.4, lon: -0.2, countryCode: 'GB' }));
    expect(placeKey({ lat: 51.5, lon: -0.12, countryCode: 'GB' })).not.toBe(placeKey(SINGAPORE));
  });

  it('asks about the new place when abroad', () => {
    const prompt = describePrompt(SINGAPORE, LONDON);
    expect(prompt.title).toBe('You appear to be in London, United Kingdom');
    expect(prompt.message).toContain('Singapore');
    expect(prompt.acceptLabel).toBe('Update times');
    expect(prompt.declineLabel).toBe('Keep Singapore');
  });

  it('offers the official timetable when back in Singapore', () => {
    const prompt = describePrompt(LONDON, SINGAPORE);
    expect(prompt.title).toBe('Back in Singapore?');
    expect(prompt.acceptLabel).toBe('Use Singapore times');
    expect(prompt.declineLabel).toBe('Keep London, United Kingdom');
  });
});
