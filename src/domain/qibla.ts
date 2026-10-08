/**
 * Qibla direction — pure, no RN. The great-circle bearing from a place to the
 * Kaaba in Masjid al-Haram, Mecca.
 */

/** The Kaaba, Masjid al-Haram (21° 25' 21" N, 39° 49' 34" E). */
export const KAABA = { lat: 21.4225, lon: 39.8262 } as const;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Wraps any angle into [0, 360). */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Initial great-circle bearing from `from` to the Kaaba, in degrees clockwise from true north. */
export function qiblaBearing(from: { lat: number; lon: number }): number {
  const dLon = toRad(KAABA.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(KAABA.lat);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}

/**
 * How far to turn from `heading` to face `bearing`: -180 to 180, positive is
 * clockwise. Always the short way round, so a dial never spins 350 degrees
 * across the 0/360 boundary.
 */
export function turnToFace(heading: number, bearing: number): number {
  const diff = normalizeDegrees(bearing - heading);
  return diff > 180 ? diff - 360 : diff;
}

/** Great-circle distance to the Kaaba in km. */
export function distanceToKaabaKm(from: { lat: number; lon: number }): number {
  const dLat = toRad(KAABA.lat - from.lat);
  const dLon = toRad(KAABA.lon - from.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
