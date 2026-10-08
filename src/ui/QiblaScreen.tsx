import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, Vibration, View } from 'react-native';

import {
  compassPoint,
  distanceToKaabaKm,
  isFacing,
  qiblaBearing,
  smoothAngle,
  turnInstruction,
} from '../domain/qibla';
import type { LocationSettings } from '../domain/types';
import * as locationService from '../services/location';
import { usePalette } from '../theme';

/**
 * A compass with the Kaaba marked on it. It first gets where the phone is now
 * (falling back to the app's saved location if that fails), then works out the
 * Qibla from there. The dial turns so north stays north; turn yourself until the
 * Kaaba sits under the pointer at the top. Phone compasses are good to a few
 * degrees, not more.
 */
export function QiblaScreen(props: { location: LocationSettings; onBack: () => void }) {
  const c = usePalette();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 56, 340);

  // Where the bearing is measured from: the phone's current position once found.
  const [place, setPlace] = useState<{ lat: number; lon: number; label: string; live: boolean } | null>(null);

  const [locating, setLocating] = useState(true);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Asks for a fresh fix. Used on opening and again whenever the user taps Refresh. It gives up after
  // 25 seconds, keeping the last good position if there is one, else the saved location.
  const locate = useCallback(async () => {
    setLocating(true);
    const fix = await Promise.race([
      locationService.requestFix(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 25_000)),
    ]);
    if (!mounted.current) return;
    if (fix) {
      setPlace({
        lat: fix.lat,
        lon: fix.lon,
        label: fix.label ?? `${fix.lat.toFixed(2)}, ${fix.lon.toFixed(2)}`,
        live: true,
      });
    } else {
      setPlace((previous) =>
        previous?.live
          ? previous
          : { lat: props.location.lat, lon: props.location.lon, label: props.location.label, live: false },
      );
    }
    setLocating(false);
  }, [props.location]);

  useEffect(() => {
    locate();
  }, [locate]);

  const bearing = place ? qiblaBearing(place) : 0;
  const km = place ? Math.round(distanceToKaabaKm(place)) : 0;

  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const smoothed = useRef<number | null>(null);
  const wasFacing = useRef(false);

  // Start the compass only once the location step is done, so the two never ask for permission at once.
  const located = place !== null;
  useEffect(() => {
    if (!located) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        const permission = existing.granted ? existing : await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setError('The compass needs the location permission to read the phone’s heading.');
          return;
        }
        subscription = await Location.watchHeadingAsync((h) => {
          const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          smoothed.current = smoothAngle(smoothed.current, raw);
          setHeading(smoothed.current);
          setAccuracy(h.accuracy);
        });
        if (cancelled) subscription.remove();
      } catch (e) {
        setError(`Could not start the compass: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [located]);

  const facing = place !== null && heading !== null && isFacing(heading, bearing);
  useEffect(() => {
    // One short buzz when you line up, not a continuous one.
    if (facing && !wasFacing.current) Vibration.vibrate(40);
    wasFacing.current = facing;
  }, [facing]);

  const dial = heading ?? 0;
  const weak = accuracy !== null && accuracy <= 1;

  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: c.bg }}>
      <Pressable accessibilityRole="button" onPress={props.onBack}>
        <Text style={[styles.back, { color: c.accent }]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: c.text }]}>Qibla</Text>
      {place ? (
        <>
          <Text style={[styles.sub, { color: c.muted }]}>
            {Math.round(bearing)}° {compassPoint(bearing)} from {place.label}
            {'  ·  '}
            {km.toLocaleString('en-GB')} km to Mecca
          </Text>
          <Text style={[styles.hint, { color: place.live ? c.accent : c.warn }]}>
            {locating
              ? 'Finding where you are…'
              : place.live
                ? 'Using your current location'
                : `Could not get a fresh location${
                    locationService.lastFixProblem ? ` (${locationService.lastFixProblem})` : ''
                  }, so using your saved one.`}
          </Text>
          <Pressable accessibilityRole="button" onPress={locate} disabled={locating} hitSlop={8}>
            <Text style={[styles.refresh, { color: locating ? c.muted : c.accent }]}>
              {locating ? 'Looking…' : 'Refresh my location'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.sub, { color: c.muted }]}>Finding where you are…</Text>
      )}

      <View style={[styles.stage, { width: size, height: size + 24 }]}>
        <View style={[styles.pointer, { borderTopColor: facing ? c.accent : c.text, left: size / 2 - 11 }]} />
        <View
          style={[
            styles.dial,
            {
              top: 24,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: facing ? c.accent : c.line,
              backgroundColor: c.card,
              transform: [{ rotate: `${-dial}deg` }],
            },
          ]}
        >
          {(['N', 'E', 'S', 'W'] as const).map((label, i) => (
            <View key={label} style={[styles.spoke, { width: size, height: size, transform: [{ rotate: `${i * 90}deg` }] }]}>
              <Text style={[styles.cardinal, { color: label === 'N' ? c.accent : c.muted }]}>{label}</Text>
            </View>
          ))}
          {place ? (
            <View style={[styles.spoke, { width: size, height: size, transform: [{ rotate: `${bearing}deg` }] }]}>
              <Text style={styles.kaaba}>🕋</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.instruction, { color: facing ? c.accent : c.text }]}>
        {error
          ? error
          : place === null
            ? 'Finding your location…'
            : heading === null
              ? 'Waiting for the compass…'
              : turnInstruction(heading, bearing)}
      </Text>

      {weak ? (
        <Text style={[styles.hint, { color: c.warn }]}>
          The compass is not well calibrated. Wave the phone in a figure 8 a few times.
        </Text>
      ) : null}

      <Text style={[styles.hint, { color: c.muted }]}>
        Hold the phone flat and away from metal, magnets and speakers. A phone compass is good to a few degrees.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, alignItems: 'center', paddingBottom: 40 },
  back: { fontSize: 17, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 24 },
  title: { fontSize: 30, fontWeight: '700' },
  sub: { fontSize: 14, textAlign: 'center' },
  stage: { marginTop: 8, alignItems: 'center' },
  pointer: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 2,
  },
  dial: { position: 'absolute', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  spoke: { position: 'absolute', alignItems: 'center' },
  cardinal: { marginTop: 12, fontSize: 20, fontWeight: '700' },
  kaaba: { marginTop: 8, fontSize: 40 },
  instruction: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  hint: { fontSize: 13, textAlign: 'center' },
  refresh: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline', textAlign: 'center' },
});
