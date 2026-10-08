/**
 * Where the phone is versus where times were last worked out — pure.
 * Ported from Steady's prayerTravel so both apps behave the same.
 */

import type { CalculationMethod, LocationSettings } from './types';

/** Further than this from the saved location counts as having travelled. */
export const TRAVEL_THRESHOLD_KM = 50;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const COUNTRY_METHOD: Record<string, CalculationMethod> = {
  SG: 'Singapore',
  MY: 'Singapore',
  ID: 'Singapore',
  BN: 'Singapore',
  SA: 'UmmAlQura',
  YE: 'UmmAlQura',
  AE: 'Dubai',
  QA: 'Qatar',
  KW: 'Kuwait',
  BH: 'Kuwait',
  OM: 'Kuwait',
  EG: 'Egyptian',
  SD: 'Egyptian',
  LY: 'Egyptian',
  SY: 'Egyptian',
  LB: 'Egyptian',
  PK: 'Karachi',
  IN: 'Karachi',
  BD: 'Karachi',
  AF: 'Karachi',
  TR: 'Turkey',
  IR: 'Tehran',
  US: 'NorthAmerica',
  CA: 'NorthAmerica',
  GB: 'MoonsightingCommittee',
  IE: 'MoonsightingCommittee',
};

export function methodForCountry(countryCode: string | null | undefined): CalculationMethod {
  if (!countryCode) return 'MuslimWorldLeague';
  return COUNTRY_METHOD[countryCode.toUpperCase()] ?? 'MuslimWorldLeague';
}

export interface LocationFix {
  lat: number;
  lon: number;
  label: string | null;
  countryCode: string | null;
}

/** Settings after a fix: the new place if it moved far enough or the user asked, else null for "unchanged". */
export function applyFix(
  current: LocationSettings,
  fix: LocationFix,
  options: { force?: boolean; thresholdKm?: number } = {},
): LocationSettings | null {
  const moved = distanceKm(current, fix) >= (options.thresholdKm ?? TRAVEL_THRESHOLD_KM);
  if (!moved && !options.force) return null;
  return {
    source: 'gps',
    lat: fix.lat,
    lon: fix.lon,
    label: fix.label ?? `${fix.lat.toFixed(2)}, ${fix.lon.toFixed(2)}`,
    countryCode: fix.countryCode,
    calculationMethod: methodForCountry(fix.countryCode),
  };
}

/** A coarse identity for a place (country plus a 5-degree cell), so "Not now" is remembered per area, not per metre. */
export function placeKey(place: { lat: number; lon: number; countryCode: string | null }): string {
  return `${place.countryCode ?? '??'}:${Math.floor(place.lat / 5)}:${Math.floor(place.lon / 5)}`;
}

export interface PlacePrompt {
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
}

/** What to ask when the phone is somewhere other than the saved location. */
export function describePrompt(saved: LocationSettings, candidate: LocationSettings): PlacePrompt {
  if (candidate.countryCode?.toUpperCase() === 'SG') {
    return {
      title: 'Back in Singapore?',
      message: `You appear to be in Singapore again. Switch back to the official Singapore timetable?`,
      acceptLabel: 'Use Singapore times',
      declineLabel: `Keep ${saved.label}`,
    };
  }
  return {
    title: `You appear to be in ${candidate.label}`,
    message: `Your prayer times are for ${saved.label}. Update them for ${candidate.label}? They will be calculated for where you are.`,
    acceptLabel: 'Update times',
    declineLabel: `Keep ${saved.label}`,
  };
}
