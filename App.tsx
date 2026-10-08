import * as IntentLauncher from 'expo-intent-launcher';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { formatClock, formatCountdown, atTime, toDateKey } from './src/domain/date';
import { formatHijri, hijriFor } from './src/domain/hijri';
import { nextPrayer, officialDaysLeft, timesFor } from './src/domain/times';
import { applyFix } from './src/domain/travel';
import { PRAYER_NAMES, SINGAPORE, type PrayerName, type Settings } from './src/domain/types';
import { buildWidgetPayload } from './src/domain/widget';
import { setWidgetData } from './modules/prayer-widget';
import * as locationService from './src/services/location';
import * as notifications from './src/services/notifications';
import { loadSettings, saveSettings } from './src/services/storage';
import { usePalette, type Palette } from './src/theme';

const PACKAGE = 'com.stdymuslim.prayertimes';

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const c = usePalette();
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [now, setNow] = useState(() => new Date());
  const [allowed, setAllowed] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const apply = useCallback(async (next: Settings) => {
    settingsRef.current = next;
    setSettingsState(next);
    saveSettings(next);
    // The widget has its own copy of the next two weeks; keep it current whenever anything changes.
    setWidgetData(JSON.stringify(buildWidgetPayload(new Date(), next.location)));
    try {
      await notifications.reschedule(next);
    } catch {
      setStatus('Could not schedule reminders on this phone.');
    }
  }, []);

  // On open and on return to the app: refresh permission, follow the phone if it travelled, requeue.
  const refresh = useCallback(async () => {
    setNow(new Date());
    setAllowed(await notifications.notificationsAllowed());
    let next = settingsRef.current;
    if (next.location.source === 'gps') {
      const fix = await locationService.quietFix();
      const moved = fix ? applyFix(next.location, fix) : null;
      if (moved) next = { ...next, location: moved };
    }
    await apply(next);
  }, [apply]);

  useEffect(() => {
    (async () => {
      await notifications.configureNotifications();
      setAllowed(await notifications.requestNotificationPermission());
      await refresh();
    })().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const today = toDateKey(now);
  const day = useMemo(() => timesFor(today, settings.location), [today, settings.location]);
  const next = nextPrayer(now, settings.location);
  const daysLeft = officialDaysLeft(now, settings.location);
  const hijri = useMemo(() => hijriFor(today), [today]);

  const useMyLocation = async () => {
    setStatus('Finding where you are…');
    const fix = await locationService.requestFix();
    if (!fix) {
      setStatus('Could not get your location. Check the location permission.');
      return;
    }
    const moved = applyFix(settings.location, fix, { force: true })!;
    await apply({ ...settings, location: moved });
    setStatus(null);
  };

  const testPrayer: PrayerName = next?.name ?? 'Asar';

  const runTest = async (kind: 'reminder' | 'prayer') => {
    try {
      setStatus('Sending…');
      if (!(await notifications.notificationsAllowed())) {
        setStatus('Notifications are off for this app. Allow them in settings.');
        return;
      }
      const shown = await notifications.sendTest(kind, settings, testPrayer);
      setStatus(
        shown
          ? 'Sent. If you heard nothing, check the phone volume and Silent mode.'
          : 'Sent, but Android did not show it. Check this app’s notification settings.',
      );
    } catch (e) {
      setStatus(`Test failed: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar style={c.bg === '#0F1512' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.date, { color: c.muted }]}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
        <Text style={[styles.hijri, { color: c.accent }]}>
          {formatHijri(hijri)}
          {hijri.official ? '' : ' (estimated)'}
        </Text>
        <Text style={[styles.place, { color: c.text }]}>
          {settings.location.label} · {day.source === 'official' ? 'Official timetable' : 'Calculated'}
        </Text>

        <View style={[styles.hero, { backgroundColor: c.card, borderColor: c.line }]}>
          {next ? (
            <>
              <Text style={[styles.heroLabel, { color: c.muted }]}>Next prayer</Text>
              <Text style={[styles.heroTitle, { color: c.text }]}>
                {next.name} in {formatCountdown(next.time.getTime() - now.getTime())}
              </Text>
              <Text style={[styles.heroSub, { color: c.accent }]}>{formatClock(next.time)}</Text>
            </>
          ) : (
            <Text style={[styles.heroTitle, { color: c.text }]}>No prayer times</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          {PRAYER_NAMES.map((name) => {
            const time = atTime(today, day.times[name]);
            const isNext = next?.name === name && toDateKey(next.time) === today;
            const past = time.getTime() <= now.getTime();
            return (
              <View key={name} style={styles.row}>
                <Text style={[styles.rowName, { color: past && !isNext ? c.muted : c.text }, isNext && styles.bold]}>
                  {name}
                </Text>
                <Text style={[styles.rowTime, { color: past && !isNext ? c.muted : c.text }, isNext && styles.bold]}>
                  {formatClock(time)}
                </Text>
              </View>
            );
          })}
        </View>

        {daysLeft !== null && daysLeft < 14 ? (
          <Text style={[styles.warn, { color: c.warn }]}>
            {daysLeft > 0
              ? `Official timetable ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Calculated times follow.`
              : 'Official timetable has ended. Times are now calculated.'}
          </Text>
        ) : null}

        {!allowed ? (
          <Action c={c} title="Notifications are off. Open settings" onPress={() => Linking.openSettings()} />
        ) : null}

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <ToggleRow
            c={c}
            label="Silent (pop-ups only)"
            value={settings.silent}
            onChange={(silent) => apply({ ...settings, silent })}
          />
          <ToggleRow
            c={c}
            label="Pause notifications"
            value={settings.paused}
            onChange={(paused) => apply({ ...settings, paused })}
          />
        </View>

        <Action
          c={c}
          title={`Test ${settings.reminderMinutes}-minute reminder`}
          onPress={() => runTest('reminder')}
        />
        <Action c={c} title="Test prayer time" onPress={() => runTest('prayer')} />
        <Action c={c} title="Use my location" onPress={useMyLocation} />
        {settings.location.source === 'gps' ? (
          <Action c={c} title="Back to Singapore" onPress={() => apply({ ...settings, location: SINGAPORE })} />
        ) : null}
        {status ? <Text style={[styles.note, { color: c.muted }]}>{status}</Text> : null}

        {Platform.OS === 'android' ? (
          <Text
            style={[styles.link, { color: c.muted }]}
            onPress={() =>
              IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
                Linking.openSettings(),
              )
            }
          >
            If reminders arrive late, set this app to “Unrestricted” in battery settings.
          </Text>
        ) : null}
        <Text style={[styles.note, { color: c.muted }]}>{PACKAGE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow(props: { c: Palette; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowName, { color: props.c.text }]}>{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        trackColor={{ true: props.c.accent, false: props.c.line }}
      />
    </View>
  );
}

function Action(props: { c: Palette; title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: props.c.card, borderColor: props.c.line }, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.actionText, { color: props.c.accent }]}>{props.title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  date: { fontSize: 14, marginTop: 8 },
  hijri: { fontSize: 18, fontWeight: '600' },
  place: { fontSize: 15, fontWeight: '600' },
  hero: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 4 },
  heroLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroTitle: { fontSize: 32, fontWeight: '700' },
  heroSub: { fontSize: 18, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowName: { fontSize: 17 },
  rowTime: { fontSize: 17, fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
  warn: { fontSize: 14 },
  action: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  actionText: { fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, textAlign: 'center' },
  link: { fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});
