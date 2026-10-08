import * as IntentLauncher from 'expo-intent-launcher';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { formatClock, formatCountdown, atTime, toDateKey } from './src/domain/date';
import { formatHijri, hijriFor } from './src/domain/hijri';
import { nextPrayer, officialDaysLeft, timesFor } from './src/domain/times';
import { applyFix, describePrompt, placeKey } from './src/domain/travel';
import { PRAYER_NAMES, SINGAPORE, type PrayerName, type Settings } from './src/domain/types';
import { buildWidgetPayload } from './src/domain/widget';
import { setScreensaverMinutes, setWidgetData } from './modules/prayer-widget';
import * as locationService from './src/services/location';
import * as notifications from './src/services/notifications';
import { loadSettings, saveSettings } from './src/services/storage';
import { QiblaScreen } from './src/ui/QiblaScreen';
import { usePalette, type Palette } from './src/theme';

const APP_PACKAGE = 'com.stdymuslim.prayertimes';

const SCREENSAVER_CHOICES = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
  { label: 'Always on', minutes: 0 },
];

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
  const [screen, setScreen] = useState<'home' | 'qibla'>('home');
  // Somewhere the phone is that differs from the saved location, waiting for the user to decide.
  const [candidate, setCandidate] = useState<Settings['location'] | null>(null);
  const askedFor = useRef<string | null>(null);
  const lastChecked = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const apply = useCallback(async (next: Settings) => {
    settingsRef.current = next;
    setSettingsState(next);
    saveSettings(next);
    // The widget has its own copy of the next two weeks; keep it current whenever anything changes.
    setWidgetData(JSON.stringify(buildWidgetPayload(new Date(), next.location)));
    setScreensaverMinutes(next.screensaverMinutes);
    try {
      await notifications.reschedule(next);
    } catch {
      setStatus('Could not schedule reminders on this phone.');
    }
  }, []);

  // Where is the phone now? If it is somewhere other than the saved location, ask; never switch silently.
  const checkPlace = useCallback(async () => {
    // At most every ten minutes: one fix each time the app is brought to the front is plenty.
    if (Date.now() - lastChecked.current < 10 * 60_000) return;
    lastChecked.current = Date.now();
    const fix = await locationService.checkFix();
    if (!fix) return;
    const current = settingsRef.current;
    const moved = applyFix(current.location, fix);
    if (!moved) {
      setCandidate(null);
      return;
    }
    setCandidate(moved);
    const key = placeKey(moved);
    if (current.declinedPlace === key || askedFor.current === key) return;
    askedFor.current = key;
    const prompt = describePrompt(current.location, moved);
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.declineLabel, style: 'cancel', onPress: () => declinePlace(key) },
      { text: prompt.acceptLabel, onPress: () => acceptPlace(moved) },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptPlace = (place: Settings['location']) => {
    setCandidate(null);
    apply({ ...settingsRef.current, location: place, declinedPlace: undefined });
  };

  const declinePlace = (key: string) => {
    apply({ ...settingsRef.current, declinedPlace: key });
  };

  // On open and on return to the app: refresh permission, requeue, then check where the phone is.
  const refresh = useCallback(async () => {
    setNow(new Date());
    setAllowed(await notifications.notificationsAllowed());
    await apply(settingsRef.current);
    await checkPlace();
  }, [apply, checkPlace]);

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
    if (screen !== 'qibla') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setScreen('home');
      return true;
    });
    return () => sub.remove();
  }, [screen]);

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

  // Android keeps the sound with each notification type, so its own settings page is the picker:
  // any system sound, or "add" one of your own audio files.
  const openSoundSettings = (kind: 'reminder' | 'prayer') =>
    IntentLauncher.startActivityAsync('android.settings.CHANNEL_NOTIFICATION_SETTINGS', {
      extra: {
        'android.provider.extra.APP_PACKAGE': APP_PACKAGE,
        'android.provider.extra.CHANNEL_ID': notifications.soundChannelId(kind),
      },
    }).catch(() => Linking.openSettings());

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

  if (screen === 'qibla') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
        <StatusBar style={c.bg === '#0F1512' ? 'light' : 'dark'} />
        <QiblaScreen location={settings.location} onBack={() => setScreen('home')} />
      </SafeAreaView>
    );
  }

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

        {candidate && settings.declinedPlace !== placeKey(candidate) ? (
          <View style={[styles.card, styles.banner, { backgroundColor: c.card, borderColor: c.warn }]}>
            <Text style={[styles.rowName, styles.bold, { color: c.text }]}>
              {describePrompt(settings.location, candidate).title}
            </Text>
            <Text style={[styles.note, styles.bannerText, { color: c.muted }]}>
              {describePrompt(settings.location, candidate).message}
            </Text>
            <View style={styles.chips}>
              <Pressable
                accessibilityRole="button"
                onPress={() => acceptPlace(candidate)}
                style={[styles.chip, { borderColor: c.accent, backgroundColor: c.accent }]}
              >
                <Text style={{ color: c.accentText, fontWeight: '600' }}>
                  {describePrompt(settings.location, candidate).acceptLabel}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => declinePlace(placeKey(candidate))}
                style={[styles.chip, { borderColor: c.line }]}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>
                  {describePrompt(settings.location, candidate).declineLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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

        <Action c={c} title="Qibla compass" onPress={() => setScreen('qibla')} />

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
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <Text style={[styles.rowName, styles.cardTitle, { color: c.text }]}>Sounds</Text>
          <Text style={[styles.note, styles.cardNote, { color: c.muted }]}>
            Choose any notification sound, or add your own audio file, in Android&apos;s sound settings.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => openSoundSettings('reminder')}>
            <Text style={[styles.actionText, styles.cardLink, { color: c.accent }]}>
              Change the {settings.reminderMinutes}-minute reminder sound
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openSoundSettings('prayer')}>
            <Text style={[styles.actionText, styles.cardLink, { color: c.accent }]}>Change the call to prayer sound</Text>
          </Pressable>
        </View>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>
          <Text style={[styles.rowName, styles.cardTitle, { color: c.text }]}>Screen saver</Text>
          <Text style={[styles.note, styles.cardNote, { color: c.muted }]}>
            Shows the date, time and countdown while charging, then goes black. Lift the phone to light it again.
          </Text>
          <View style={styles.chips}>
            {SCREENSAVER_CHOICES.map((choice) => {
              const on = settings.screensaverMinutes === choice.minutes;
              return (
                <Pressable
                  key={choice.label}
                  accessibilityRole="button"
                  onPress={() => apply({ ...settings, screensaverMinutes: choice.minutes })}
                  style={[
                    styles.chip,
                    { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : 'transparent' },
                  ]}
                >
                  <Text style={{ color: on ? c.accentText : c.text, fontWeight: '600' }}>{choice.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              IntentLauncher.startActivityAsync('android.settings.DREAM_SETTINGS').catch(() => Linking.openSettings())
            }
          >
            <Text style={[styles.actionText, styles.cardLink, { color: c.accent }]}>Choose Prayer Times as my screen saver</Text>
          </Pressable>
        </View>
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
        <View style={styles.footer}>
          <Text style={[styles.footerName, { color: c.muted }]}>Prayer Times SG</Text>
          <Text style={[styles.note, { color: c.muted }]}>stdymuslim@gmail.com</Text>
        </View>
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
  banner: { paddingVertical: 14, gap: 6 },
  bannerText: { textAlign: 'left' },
  footer: { alignItems: 'center', gap: 2, marginTop: 8, marginBottom: 12 },
  footerName: { fontSize: 14, fontWeight: '600' },
  cardTitle: { fontWeight: '600', marginTop: 10 },
  cardNote: { textAlign: 'left', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  cardLink: { textAlign: 'left', marginTop: 14, marginBottom: 12 },
  link: { fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});
