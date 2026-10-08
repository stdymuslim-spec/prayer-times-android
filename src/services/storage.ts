/** Settings persisted in expo-sqlite's key-value store — small, synchronous, no extra dependency. */

import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_SETTINGS, type LocationSettings, type Settings } from '../domain/types';

const KEY = 'settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = Storage.getItemSync(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      location: { ...DEFAULT_SETTINGS.location, ...(saved.location as Partial<LocationSettings> | undefined) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  Storage.setItemSync(KEY, JSON.stringify(settings));
}
