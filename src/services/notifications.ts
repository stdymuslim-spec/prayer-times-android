/**
 * Scheduling on Android. Alarms are set with the OS, so they fire with the app
 * closed. Notification channels are immutable once created (Android ignores a
 * second call with a different sound), so each sound variant has its own
 * permanent channel id — never edit a channel in place, add a new id.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { planNotifications } from '../domain/plan';
import type { ChosenSound, PrayerName, Settings } from '../domain/types';

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

// Which sound files were bundled into this build (see app.config.js). Channels are immutable once
// created, so a build with a bundled sound and one without use different channel ids.
const bundled = ((Constants.expoConfig?.extra as { sounds?: Record<string, boolean> } | undefined)?.sounds ?? {}) as Record<
  string,
  boolean
>;

const CHANNELS: Record<Kind, { chime: string; quiet: string }> = {
  reminder: { chime: bundled.reminder ? 'reminder-chime-v1' : 'reminder-default-v1', quiet: 'reminder-silent-v1' },
  prayer: { chime: bundled.call_to_prayer ? 'prayer-adhan-v1' : 'prayer-default-v1', quiet: 'prayer-silent-v1' },
};

/** The sound of the loud channel: the bundled file if there is one, else Android's default. */
const SOUND: Record<Kind, string> = {
  reminder: bundled.reminder ? 'reminder' : 'default',
  prayer: bundled.call_to_prayer ? 'call_to_prayer' : 'default',
};

/** What the sound is called when the user hasn't picked one. */
export function builtInSoundName(kind: Kind): string {
  if (kind === 'reminder') return bundled.reminder ? 'Built-in chime' : 'Android default';
  return bundled.call_to_prayer ? 'Built-in call to prayer' : 'Android default';
}

/** The channel to post on: the user's own sound if they picked one, else the built-in one. */
export function channelFor(kind: Kind, silent: boolean, chosen?: Partial<Record<Kind, ChosenSound>>): string {
  if (silent) return CHANNELS[kind].quiet;
  return chosen?.[kind]?.channelId ?? CHANNELS[kind].chime;
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
    sound: SOUND.reminder,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.reminder.quiet, {
    ...base,
    name: 'Reminder before prayer (silent)',
    sound: null,
  });
  await Notifications.setNotificationChannelAsync(CHANNELS.prayer.chime, {
    ...base,
    name: 'Prayer time',
    sound: SOUND.prayer,
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
        channelId: channelFor(item.kind, settings.silent, settings.sounds),
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
    trigger: { channelId: channelFor(kind, settings.silent, settings.sounds) },
  });
  // Check up to ~2 seconds for it to appear, stopping as soon as it does.
  for (let waited = 0; waited < 2000; waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const shown = await Notifications.getPresentedNotificationsAsync();
    if (shown.some((n) => n.request.identifier === id)) return true;
  }
  return false;
}
