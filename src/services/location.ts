/**
 * One-shot location fixes — never continuous tracking. Permission is only
 * requested when the user taps "Use my location"; the check on app open uses
 * the OS's cached position and only if permission was already granted.
 */

import * as Location from 'expo-location';
import Storage from 'expo-sqlite/kv-store';

import type { LocationFix } from '../domain/travel';

const PRECISE_ASKED_KEY = 'location-precise-asked-v1';

/**
 * Prayer times and the Qibla need a good fix. If the user earlier chose "Approximate", ask once more:
 * Android then offers Precise again. After that, respect whatever they pick.
 */
async function offerPrecise(permission: Location.LocationPermissionResponse): Promise<Location.LocationPermissionResponse> {
  if (!permission.granted || permission.android?.accuracy !== 'coarse' || !permission.canAskAgain) return permission;
  if (Storage.getItemSync(PRECISE_ASKED_KEY)) return permission;
  Storage.setItemSync(PRECISE_ASKED_KEY, '1');
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted ? asked : permission;
}

async function placeFor(lat: number, lon: number): Promise<{ label: string | null; countryCode: string | null }> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!place) return { label: null, countryCode: null };
    return {
      // 'Singapore' and not 'Singapore, Singapore' when the city and country share a name.
      label: [...new Set([place.city ?? place.subregion, place.country].filter(Boolean))].join(', ') || null,
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
    const asked = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
    const permission = await offerPrecise(asked);
    if (!permission.granted) return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lon } = position.coords;
    return { lat, lon, ...(await placeFor(lat, lon)) };
  } catch {
    return null;
  }
}

const ASKED_KEY = 'location-asked-v1';

/**
 * The check made when the app opens: where is the phone now? Asks for the
 * location permission once, the first time ever, and never again after that.
 * Null if there's no permission or no fix within ~8 seconds.
 */
export async function checkFix(): Promise<LocationFix | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (Storage.getItemSync(ASKED_KEY) || !permission.canAskAgain) return null;
      Storage.setItemSync(ASKED_KEY, '1');
      permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return null;
    }
    permission = await offerPrecise(permission);
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    const found = position ?? (await Location.getLastKnownPositionAsync());
    if (!found) return null;
    const { latitude: lat, longitude: lon } = found.coords;
    return { lat, lon, ...(await placeFor(lat, lon)) };
  } catch {
    return null;
  }
}
