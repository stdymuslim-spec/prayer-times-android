import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type PrayerWidgetNative = {
  setData(json: string): void;
  setScreensaverMinutes(minutes: number): void;
};

function native(): PrayerWidgetNative | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<PrayerWidgetNative>('PrayerWidget');
  } catch {
    return null; // The widget and screensaver are extras; the app works without them.
  }
}

/** Hands the widget and screensaver their data. A no-op where they don't exist. */
export function setWidgetData(json: string): void {
  try {
    native()?.setData(json);
  } catch {
    // ignore
  }
}

/** How long the screensaver stays lit before going black; 0 keeps it lit. */
export function setScreensaverMinutes(minutes: number): void {
  try {
    native()?.setScreensaverMinutes(minutes);
  } catch {
    // ignore
  }
}
