/** Pure domain types — no React Native imports anywhere in src/domain. */

export const PRAYER_NAMES = ['Subuh', 'Syuruk', 'Zohor', 'Asar', 'Maghrib', 'Isyak'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

/** Syuruk (sunrise) is shown in the timetable but never notified, as on the Mac app. */
export const NOTIFIED_PRAYERS: readonly PrayerName[] = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];

/** 'HH:MM' local clock time for each prayer on one day. */
export type DayTimes = Record<PrayerName, string>;

export type CalculationMethod =
  | 'Singapore'
  | 'MuslimWorldLeague'
  | 'UmmAlQura'
  | 'Egyptian'
  | 'Karachi'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'MoonsightingCommittee'
  | 'NorthAmerica'
  | 'Turkey'
  | 'Tehran';

export interface LocationSettings {
  source: 'default' | 'gps';
  lat: number;
  lon: number;
  label: string;
  /** ISO 3166-1 alpha-2 of the last GPS fix; null when unknown. */
  countryCode: string | null;
  calculationMethod: CalculationMethod;
}

export interface Settings {
  /** Pop-ups only, no sound. */
  silent: boolean;
  /** No notifications at all. */
  paused: boolean;
  reminderMinutes: number;
  /** Minutes the screensaver stays lit before going black; 0 means it never does. */
  screensaverMinutes: number;
  /** placeKey of a place the user chose not to switch to, so it is not asked about again. */
  declinedPlace?: string;
  location: LocationSettings;
}

export const SINGAPORE: LocationSettings = {
  source: 'default',
  lat: 1.3521,
  lon: 103.8198,
  label: 'Singapore',
  countryCode: 'SG',
  calculationMethod: 'Singapore',
};

export const DEFAULT_SETTINGS: Settings = {
  silent: false,
  paused: false,
  reminderMinutes: 10,
  screensaverMinutes: 10,
  location: SINGAPORE,
};
