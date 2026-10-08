/**
 * Astronomical prayer times via `adhan` (pure JS). Used wherever the official
 * Singapore timetable doesn't apply — abroad, or after the bundled year ends.
 * Formats with the device's local clock, correct while the phone's timezone
 * matches where it physically is.
 */

import {
  CalculationMethod as AdhanMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';

import { fromDateKey } from './date';
import type { CalculationMethod, DayTimes, LocationSettings } from './types';

const METHOD_FACTORY: Record<CalculationMethod, () => ReturnType<typeof AdhanMethod.Singapore>> = {
  Singapore: AdhanMethod.Singapore,
  MuslimWorldLeague: AdhanMethod.MuslimWorldLeague,
  UmmAlQura: AdhanMethod.UmmAlQura,
  Egyptian: AdhanMethod.Egyptian,
  Karachi: AdhanMethod.Karachi,
  Dubai: AdhanMethod.Dubai,
  Qatar: AdhanMethod.Qatar,
  Kuwait: AdhanMethod.Kuwait,
  MoonsightingCommittee: AdhanMethod.MoonsightingCommittee,
  NorthAmerica: AdhanMethod.NorthAmerica,
  Turkey: AdhanMethod.Turkey,
  Tehran: AdhanMethod.Tehran,
};

const pad = (n: number) => String(n).padStart(2, '0');
const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function calculateTimes(dateKey: string, location: LocationSettings): DayTimes {
  const coordinates = new Coordinates(location.lat, location.lon);
  const params = METHOD_FACTORY[location.calculationMethod]();
  params.madhab = Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);

  const t = new PrayerTimes(coordinates, fromDateKey(dateKey), params);
  return {
    Subuh: toHHMM(t.fajr),
    Syuruk: toHHMM(t.sunrise),
    Zohor: toHHMM(t.dhuhr),
    Asar: toHHMM(t.asr),
    Maghrib: toHHMM(t.maghrib),
    Isyak: toHHMM(t.isha),
  };
}
