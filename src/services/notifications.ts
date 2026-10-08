/**
 * Scheduling on Android. Alarms are set with the OS, so they fire with the app
 * closed. Notification channels are immutable once created (Android ignores a
 * second call with a different sound), so each sound variant has its own
 * permanent channel id — never edit a channel in place, add a new id.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planNotifications } from '../domain/plan';
import type { PrayerName, Settings } from '../domain/types';

type Kind = 'reminder' | 'prayer';

// Without this, Android only shows a notification while the app is closed or in the
// background: tapping a test button inside the app would post nothing, and a reminder
// that lands while the app is open on screen would be silently dropped.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNELS: Record<Kind, { chime: string; quiet: string }> = {
  reminder: { chime: 'reminder-chime-v1', quiet: 'reminder-silent-v1' },
  prayer: { chime: 'prayer-adhan-v1', quiet: 'prayer-silent-v1' },
};

export function channelFor(kind: Kind, silent: boolean): string {
  return silent ? CHANNELS[kind].quiet : CHANNELS[kind].chime;
}

export async function configureNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const base = {
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  };
  await Notifications.setNotificationChannelAsync(CHANNELS.reminder.chime, {
    ...base,
    name: 'Reminder before prayer',
    sound: 'reminder',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.reminder.quiet, {
    ...base,
    name: 'Reminder before prayer (silent)',
    sound: null,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.prayer.chime, {
    ...base,
    name: 'Prayer time',
    sound: 'call_to_prayer',
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.prayer.quiet, {
    ...base,
    name: 'Prayer time (silent)',
    sound: null,
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Replaces everything queued with the plan for the current settings. Paused means nothing queued. */
export async function reschedule(settings: Settings, now = new Date()): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (settings.paused) return 0;

  const plan = planNotifications(now, settings.location, settings.reminderMinutes);
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title: item.title,
        data: { kind: item.kind, prayer: item.prayer },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
        channelId: channelFor(item.kind, settings.silent),
      },
    });
  }
  return plan.length;
}

/**
 * Fires one straight away, through the same channel a real one would use.
 * Returns whether Android is actually showing it, so the screen can say so.
 */
export async function sendTest(kind: Kind, settings: Settings, prayer: PrayerName): Promise<boolean> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: kind === 'reminder' ? `${settings.reminderMinutes} minutes to ${prayer}` : `It's time for ${prayer}.`,
      data: { kind, prayer, test: true },
    },
    // A channel-only trigger posts immediately.
    trigger: { channelId: channelFor(kind, settings.silent) },
  });
  // Check up to ~2 seconds for it to appear, stopping as soon as it does.
  for (let waited = 0; waited < 2000; waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const shown = await Notifications.getPresentedNotificationsAsync();
    if (shown.some((n) => n.request.identifier === id)) return true;
  }
  return false;
}
