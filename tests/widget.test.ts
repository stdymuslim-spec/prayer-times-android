import { describe, expect, it } from 'vitest';

import { atTime } from '../src/domain/date';
import { SINGAPORE } from '../src/domain/types';
import { buildWidgetPayload } from '../src/domain/widget';

describe('buildWidgetPayload', () => {
  const now = atTime('2026-10-08', '10:00');
  const payload = buildWidgetPayload(now, SINGAPORE, 3);

  it('labels each day in Gregorian and MUIS Hijri', () => {
    expect(Object.keys(payload.days)).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(payload.days['2026-10-08']).toEqual(['Thu, 8 Oct 2026', '26 Rabiulakhir 1448H']);
    expect(payload.days['2026-10-10'][1]).toBe('28 Rabiulakhir 1448H');
  });

  it('lists five prayers a day in time order with epoch times and clock text', () => {
    expect(payload.prayers).toHaveLength(15);
    const times = payload.prayers.map((p) => p[1]);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const [name, at, clock] = payload.prayers[0];
    expect(name).toBe('Subuh');
    expect(new Date(at).getHours()).toBe(Number(clock.split(':')[0]) % 12 === 0 ? 12 : new Date(at).getHours());
    expect(clock).toMatch(/^\d{1,2}:\d{2} (am|pm)$/);
  });

  it('serialises to compact JSON the native widget can read', () => {
    const json = JSON.stringify(payload);
    expect(JSON.parse(json).days['2026-10-08'][0]).toBe('Thu, 8 Oct 2026');
    expect(json.length).toBeLessThan(4000);
  });
});
