import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Capy } from '@/components/Capy';
import { Button, Card, Chip, Header, IconButton, Notice, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import {
  DURATIONS, KIND_OF_MODE, MEDITATION_PROMPTS, PATTERNS, SCALE_SMALL, SLEEP_PROMPTS, SOUNDS, decodePreset, encodePreset, patternById,
  phaseAt, phaseTargetScale, wellnessProgress, type SessionMode, type SessionPreset, type SoundId,
} from '@/lib/wellness';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const SOURCES: Record<Exclude<SoundId, 'none'>, number> = {
  rain: require('../../assets/sounds/rain.wav'),
  forest: require('../../assets/sounds/forest.wav'),
  ocean: require('../../assets/sounds/ocean.wav'),
};
const MIN_LOGGED_SECONDS = 20;
const FADE_SECONDS = 20;
const MODES: { id: SessionMode; label: string; blurb: string }[] = [
  { id: 'breathing', label: 'Breathe', blurb: 'Follow the circle with a guided breathing pattern.' },
  { id: 'meditation', label: 'Meditate', blurb: 'A quiet sit with gentle prompts and your own pace.' },
  { id: 'sleep', label: 'Sleep & relax', blurb: 'Slow, dim and calming. Fades out so you can drift off.' },
];
const DEFAULTS: Record<SessionMode, { pattern: string; minutes: number; sound: SoundId }> = {
  breathing: { pattern: '446', minutes: 3, sound: 'none' },
  meditation: { pattern: 'calm', minutes: 5, sound: 'forest' },
  sleep: { pattern: '478', minutes: 10, sound: 'ocean' },
};

export default function Meditate() {
  const params = useLocalSearchParams<{ preset?: string }>();
  const initial = useMemo(() => (typeof params.preset === 'string' ? decodePreset(params.preset) : null), [params.preset]);
  const { repo, bump } = useApp();
  const [mode, setMode] = useState<SessionMode>(initial?.mode ?? 'breathing');
  const [pattern, setPattern] = useState(initial?.pattern ?? DEFAULTS.breathing.pattern);
  const [minutes, setMinutes] = useState<number>(initial?.minutes ?? DEFAULTS.breathing.minutes);
  const [sound, setSound] = useState<SoundId>(initial?.sound ?? DEFAULTS.breathing.sound);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const preset: SessionPreset = { mode, pattern, minutes, sound };
  const key = encodePreset(preset);
  const { data } = useData(async (r) => {
    const [sessions, saved] = await Promise.all([r.listSessions(), r.isBookmarked('session', key)]);
    return { progress: wellnessProgress(sessions), saved };
  }, [key]);

  const chooseMode = (m: SessionMode) => { setMode(m); setPattern(DEFAULTS[m].pattern); setMinutes(DEFAULTS[m].minutes); setSound(DEFAULTS[m].sound); };

  const finish = useCallback(async (seconds: number) => {
    setRunning(false);
    if (seconds < MIN_LOGGED_SECONDS) { setDone(0); return; }
    const logged = await attempt(async () => { await repo.addSession(KIND_OF_MODE[mode], `${pattern}-${minutes}`, seconds / 60); bump(); return true; }, 'record that session');
    setDone(logged ? seconds / 60 : 0);
  }, [repo, bump, mode, pattern, minutes]);

  if (running) return <Player preset={preset} onEnd={finish} />;

  if (done !== null) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Capy pose={done ? 'celebrate' : 'calm'} size={160} motion="pop" label="Cappy" />
          <Text variant="title" style={{ marginTop: space.lg, textAlign: 'center' }}>{done ? 'Well done' : 'Maybe next time'}</Text>
          <Text variant="body" style={{ textAlign: 'center', marginTop: space.xs }}>
            {done ? `You gave yourself ${Math.max(1, Math.round(done))} ${Math.round(done) <= 1 ? 'minute' : 'minutes'}. That counts.` : 'Sessions under 20 seconds are not recorded. Every pause is welcome.'}
          </Text>
        </View>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Button label="Again" onPress={() => setDone(null)} />
          <Button label="See my journey" variant="secondary" onPress={() => router.replace('/journey')} />
          <Button label="Done" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const progress = data?.progress;
  return (
    <Screen>
      <Header title="Meditate & breathe" back subtitle="1 to 10 minutes. No scores, no streaks." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm }}>
        {MODES.map((m) => <Chip key={m.id} label={m.label} selected={mode === m.id} onPress={() => chooseMode(m.id)} />)}
      </View>
      <Text variant="small" style={{ marginBottom: space.lg }}>{MODES.find((m) => m.id === mode)?.blurb}</Text>

      <Text variant="h3" style={{ marginBottom: space.sm }}>{mode === 'meditation' ? 'Breathing rhythm' : 'Pattern'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {PATTERNS.map((p) => <Chip key={p.id} label={p.label} selected={pattern === p.id} onPress={() => setPattern(p.id)} />)}
      </View>
      <Text variant="small" style={{ marginTop: space.xs, marginBottom: space.lg }}>{patternById(pattern).hint}</Text>

      <Text variant="h3" style={{ marginBottom: space.sm }}>Length</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        {DURATIONS.map((d) => <Chip key={d} label={`${d} min`} selected={minutes === d} onPress={() => setMinutes(d)} />)}
      </View>

      <Text variant="h3" style={{ marginBottom: space.sm }}>Sound</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
        {SOUNDS.map((s) => <Chip key={s.id} label={s.label} selected={sound === s.id} onPress={() => setSound(s.id)} />)}
      </View>

      <Button label="Start" icon="play" onPress={() => setRunning(true)} />
      <Button label={data?.saved ? 'Saved for later' : 'Save this session for later'} variant="secondary" icon={data?.saved ? 'bookmark' : 'bookmark-outline'}
        style={{ marginTop: space.sm }}
        onPress={() => { void attempt(async () => { await repo.toggleBookmark('session', key); bump(); }); }} />

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.xl, marginBottom: space.sm }}>Your practice</Text>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Stat label="MINUTES THIS WEEK" value={String(progress?.minutesThisWeek ?? 0)} />
          <Stat label="SESSIONS" value={String(progress?.sessionsThisWeek ?? 0)} />
          <Stat label="ALL TIME (MIN)" value={String(progress?.minutesTotal ?? 0)} />
        </View>
        <View style={styles.bars} accessible accessibilityLabel="Minutes practised over the last seven days">
          {(progress?.days ?? Array.from({ length: 7 }, (_, i) => ({ day: i, minutes: 0 }))).map((d) => (
            <View key={d.day} style={[styles.bar, { height: 6 + Math.min(40, d.minutes * 4), backgroundColor: d.minutes ? colors.red : colors.border }]} />
          ))}
        </View>
      </Card>
      <Notice icon="information-circle-outline" text="Ambient sounds are generated in the app. Meditation is relaxation practice, not medical treatment." />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy }}>{value}</Text>
      <Text variant="label" style={{ fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

/** The running session: breathing circle, countdown, optional prompts and sound. */
function Player({ preset, onEnd }: { preset: SessionPreset; onEnd: (seconds: number) => void }) {
  const total = preset.minutes * 60;
  const pat = patternById(preset.pattern);
  const [elapsed, setElapsed] = useState(0);
  const [scale] = useState(() => new Animated.Value(SCALE_SMALL));
  const scaleNow = useRef(SCALE_SMALL);
  const [startedAt] = useState(() => Date.now());
  const player = useRef<AudioPlayer | null>(null);
  const ended = useRef(false);
  const dark = preset.mode === 'sleep';

  const end = useCallback((seconds: number) => {
    if (ended.current) return;
    ended.current = true;
    onEnd(seconds);
  }, [onEnd]);

  useEffect(() => {
    const id = scale.addListener(({ value }) => { scaleNow.current = value; });
    return () => scale.removeListener(id);
  }, [scale]);

  // Sound
  useEffect(() => {
    if (preset.sound === 'none') return;
    let alive = true;
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (!alive) return;
        const p = createAudioPlayer(SOURCES[preset.sound as Exclude<SoundId, 'none'>]);
        p.loop = true;
        p.volume = 0.8;
        p.play();
        player.current = p;
      } catch { /* the session still works in silence */ }
    })();
    return () => {
      alive = false;
      try { player.current?.pause(); player.current?.remove(); } catch { /* already released */ }
      player.current = null;
    };
  }, [preset.sound]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => {
      const secs = (Date.now() - startedAt) / 1000;
      setElapsed(secs);
      if (secs >= total) { end(total); return; }
      // Sleep mode fades the sound out over the last seconds.
      if (preset.mode === 'sleep' && player.current && total - secs < FADE_SECONDS) {
        try { player.current.volume = Math.max(0, 0.8 * ((total - secs) / FADE_SECONDS)); } catch { /* ignore */ }
      }
    }, 250);
    return () => clearInterval(t);
  }, [total, end, preset.mode, startedAt]);

  const state = phaseAt(pat, elapsed);
  const phaseKey = `${state.cycle}:${state.index}`;
  useEffect(() => {
    Animated.timing(scale, {
      toValue: phaseTargetScale(state.phase.name, scaleNow.current), duration: state.phase.seconds * 1000,
      easing: Easing.inOut(Easing.sin), useNativeDriver: true,
    }).start();
    Haptics.selectionAsync().catch(() => { /* haptics not available */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  const prompts = preset.mode === 'sleep' ? SLEEP_PROMPTS : MEDITATION_PROMPTS;
  const prompt = preset.mode === 'breathing' ? null : prompts[Math.floor(elapsed / 20) % prompts.length];
  const left = Math.max(0, Math.ceil(total - elapsed));
  const fg = dark ? '#E8ECF7' : colors.navy;

  return (
    <SafeAreaView style={[styles.player, dark && { backgroundColor: '#0B1020' }]}>
      <View style={{ alignItems: 'flex-end', padding: space.md }}>
        <IconButton icon="close" label="End session" color={fg} onPress={() => end(elapsed)} />
      </View>
      <View style={styles.center}>
        <View style={styles.box}>
          <Animated.View style={[styles.circle, { transform: [{ scale }] }, dark && { backgroundColor: '#2B3A67' }]} accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants" />
          <Text style={{ color: fg, fontSize: 44, fontWeight: '800' }}>{state.secondsLeft}</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.phase, { color: fg }]}>{state.phase.name}</Text>
        {prompt ? <Text variant="body" style={{ color: fg, textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.xl, opacity: 0.85 }}>{prompt}</Text> : null}
      </View>
      <View style={{ alignItems: 'center', paddingBottom: space.xl }}>
        <Text variant="small" style={{ color: fg, opacity: 0.7 }}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left · {pat.label}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Finish now" onPress={() => end(elapsed)} style={{ padding: space.md }}>
          <Ionicons name="stop-circle-outline" size={36} color={fg} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CIRCLE = 220;
const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 52, marginTop: space.lg, gap: 6 },
  bar: { flex: 1, borderRadius: 4 },
  player: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { width: CIRCLE, height: CIRCLE, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: '#FBD5DC' },
  phase: { fontSize: 28, fontWeight: '800', marginTop: space.lg },
});

