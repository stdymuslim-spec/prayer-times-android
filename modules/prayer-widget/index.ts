import { requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type PrayerWidgetNative = { setData(json: string): void };

/** Hands the widget its data. A no-op where the widget doesn't exist. */
export function setWidgetData(json: string): void {
  if (Platform.OS !== 'android') return;
  try {
    requireNativeModule<PrayerWidgetNative>('PrayerWidget').setData(json);
  } catch {
    // The widget is a bonus; the app keeps working without it.
  }
}
