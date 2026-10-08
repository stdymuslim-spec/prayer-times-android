import { describe, expect, it } from 'vitest';

import { distanceToKaabaKm, KAABA, normalizeDegrees, qiblaBearing, turnToFace } from '../src/domain/qibla';

describe('qiblaBearing', () => {
  // Well-known Qibla bearings (degrees from true north), allowing 1 degree.
  const cases: [string, number, number, number][] = [
    ['Singapore', 1.3521, 103.8198, 293.0],
    ['London', 51.5074, -0.1278, 118.99],
    ['New York', 40.7128, -74.006, 58.48],
    ['Sydney', -33.8688, 151.2093, 277.5],
    ['Jakarta', -6.2088, 106.8456, 295.0],
    ['Istanbul', 41.0082, 28.9784, 151.6],
  ];
  it.each(cases)('%s', (_name, lat, lon, expected) => {
    expect(Math.abs(qiblaBearing({ lat, lon }) - expected)).toBeLessThan(1);
  });

  it('points due north-ish from just south of Mecca and south from far north', () => {
    expect(qiblaBearing({ lat: 10, lon: KAABA.lon })).toBeCloseTo(0, 5);
    expect(qiblaBearing({ lat: 60, lon: KAABA.lon })).toBeCloseTo(180, 5);
  });

  it('is always within [0, 360)', () => {
    for (const lat of [-80, -30, 0, 30, 80]) {
      for (const lon of [-170, -90, 0, 90, 170]) {
        const b = qiblaBearing({ lat, lon });
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      }
    }
  });
});

describe('turnToFace', () => {
  it('turns the short way round across north', () => {
    expect(turnToFace(350, 10)).toBe(20);
    expect(turnToFace(10, 350)).toBe(-20);
  });
  it('is zero when facing the bearing, and at most 180 either way', () => {
    expect(turnToFace(293, 293)).toBe(0);
    expect(Math.abs(turnToFace(0, 180))).toBe(180);
    expect(turnToFace(90, 300)).toBe(-150);
  });
});

describe('helpers', () => {
  it('normalises angles', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(370)).toBe(10);
  });
  it('measures about 7,000 km from Singapore to Mecca', () => {
    expect(distanceToKaabaKm({ lat: 1.3521, lon: 103.8198 })).toBeGreaterThan(6800);
    expect(distanceToKaabaKm({ lat: 1.3521, lon: 103.8198 })).toBeLessThan(7300);
  });
});
