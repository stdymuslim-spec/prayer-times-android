/**
 * The notifications to have queued: a reminder `reminderMinutes` before each
 * prayer and one at the prayer, for the next several days. Pure — the service
 * layer turns this into scheduled notifications.
 */

import { upcomingPrayers } from './times';
import type { LocationSettings, PrayerName } from './types';

export const HORIZON_DAYS = 14;

export interface PlannedNotification {
  /** Stable id: kind + prayer + start time. */
  id: string;
  kind: 'reminder' | 'prayer';
  prayer: PrayerName;
  fireAt: Date;
  title: string;
}

export function planNotifications(
  now: Date,
  location: LocationSettings,
  reminderMinutes: number,
  horizonDays = HORIZON_DAYS,
): PlannedNotification[] {
  const planned: PlannedNotification[] = [];
  for (const { name, time } of upcomingPrayers(now, horizonDays, location)) {
    const stamp = time.getTime();
    const reminderAt = new Date(stamp - reminderMinutes * 60_000);
    if (reminderAt.getTime() > now.getTime()) {
      planned.push({
        id: `reminder:${name}:${stamp}`,
        kind: 'reminder',
        prayer: name,
        fireAt: reminderAt,
        title: `${reminderMinutes} minutes to ${name}`,
      });
    }
    if (stamp > now.getTime()) {
      planned.push({
        id: `prayer:${name}:${stamp}`,
        kind: 'prayer',
        prayer: name,
        fireAt: time,
        title: `It's time for ${name}.`,
      });
    }
  }
  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
