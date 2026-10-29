import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Capy } from '@/components/Capy';
import { Button, Card, EmptyState, Header, IconTile, Screen, Text } from '@/components/ui';
import { accents, colors, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { breakSeconds, microBreakById, stepAt } from '@/lib/wellness';
import { useApp } from '@/state/AppProvider';

/** Walks through one micro-break step by step, then records it as a completed reset. */
export default function MicroBreakPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, bump } = useApp();
  const brk = microBreakById(String(id));
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const lastStep = useRef(-1);
  const recorded = useRef(false);

  const total = brk ? breakSeconds(brk) : 0;
  const finished = started && elapsed >= total;

  useEffect(() => {
    if (!brk || !started || finished) return;
    const t = setInterval(() => {
      const secs = Math.min(total, (Date.now() - startedAt.current) / 1000);
      setElapsed(secs);
      // Record the reset once, the moment the last step ends.
      if (secs >= total && !recorded.current) {
        recorded.current = true;
        void attempt(async () => { await repo.addSession('microbreak', brk.id, total / 60); bump(); }, 'record that break');
      }
    }, 250);
    return () => clearInterval(t);
  }, [brk, started, finished, total, repo, bump]);

  const step = brk ? stepAt(brk, elapsed) : null;
  useEffect(() => {
    if (!started || !step || step.index === lastStep.current) return;
    lastStep.current = step.index;
    Haptics.selectionAsync().catch(() => { /* haptics not available */ });
  }, [started, step]);

  if (!brk) return <Screen><Header title="Micro-break" back /><EmptyState capy="surprised" title="Break not found" /></Screen>;

  if (finished) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <Capy pose="cheer" size={160} motion="pop" label="Cappy cheering" />
          <Text variant="title" style={{ marginTop: space.lg, textAlign: 'center' }}>Reset complete</Text>
          <Text variant="body" style={{ textAlign: 'center', marginTop: space.xs }}>Back to it, refreshed.</Text>
        </View>
        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Button label="Another break" variant="secondary" onPress={() => router.replace('/microbreaks')} />
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const pct = total ? Math.min(1, elapsed / total) : 0;
  return (
    <Screen>
      <Header title={brk.title} back subtitle={brk.blurb} />
      {!started ? (
        <>
          <Card style={{ marginBottom: space.lg }}>
            {brk.steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 6 }}>
                <Text variant="h3" style={{ color: colors.red, width: 18 }}>{i + 1}</Text>
                <Text variant="body" style={{ flex: 1 }}>{s.text}</Text>
              </View>
            ))}
          </Card>
          <Button label="Start" icon="play" onPress={() => { startedAt.current = Date.now(); setStarted(true); }} />
        </>
      ) : (
        <>
          <View style={{ alignItems: 'center', marginVertical: space.lg }}>
            <IconTile icon={brk.icon} accent={brk.accent} size={72} />
            <Text variant="small" style={{ marginTop: space.md }}>Step {(step?.index ?? 0) + 1} of {brk.steps.length}</Text>
            <Text variant="h2" accessibilityLiveRegion="polite" style={{ textAlign: 'center', marginTop: space.sm }}>{step ? brk.steps[step.index].text : ''}</Text>
            <Text style={{ fontSize: 48, fontWeight: '800', color: colors.navy, marginTop: space.md }}>{step?.secondsLeft ?? 0}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden', marginBottom: space.lg }}>
            <View style={{ height: 8, width: `${pct * 100}%`, backgroundColor: accents.green.fg }} />
          </View>
          <Button label="Stop" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}
