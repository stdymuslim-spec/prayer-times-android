/**
 * One-shot location fixes — never continuous tracking. Permission is only
 * requested when the user taps "Use my location"; the check on app open uses
 * the OS's cached position and only if permission was already granted.
 */

import * as Location from 'expo-location';

import type { LocationFix } from '../domain/travel';

async function placeFor(lat: number, lon: number): Promise<{ label: string | null; countryCode: string | null }> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!place) return { label: null, countryCode: null };
    return {
      label: [place.city ?? place.subregion, place.country].filter(Boolean).join(', ') || null,
      countryCode: place.isoCountryCode ?? null,
    };
  } catch {
    return { label: null, countryCode: null };
  }
}

/** Asks for permission if needed, then a fresh fix. Null if refused or unavailable. */
export async function requestFix(): Promise<LocationFix | null> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    const permission = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lon } = position.coords;
    return { lat, lon, ...(await placeFor(lat, lon)) };
  } catch {
    return null;
  }
}

/** For the travel check: never prompts, prefers the cached position. */
export async function quietFix(): Promise<LocationFix | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!position) return null;
    const { latitude: lat, longitude: lon } = position.coords;
    return { lat, lon, ...(await placeFor(lat, lon)) };
  } catch {
    return null;
  }
}
