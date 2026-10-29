import { useState } from 'react';
import { View } from 'react-native';
import { CapySays } from '@/components/Capy';
import { Button, Header, Notice, Screen, Text } from '@/components/ui';
import { TopicPicker, TopicProgress } from '@/components/TopicPicker';
import { colors, space } from '@/constants/brand';
import { topicsLine } from '@/lib/capy';
import { MIN_TOPIC_COUNT, canContinue } from '@/lib/topics';
import { useApp } from '@/state/AppProvider';

export default function ChooseTopics() {
  const { completeOnboarding } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capy = topicsLine(selected.length, MIN_TOPIC_COUNT);

  const save = async () => {
    setBusy(true); setError(null);
    try { await completeOnboarding(selected); }
    catch { setError('Could not save your choices. Check your internet connection and try again.'); setBusy(false); }
  };

  return (
    <Screen
      footer={
        <View style={{ padding: space.lg, gap: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TopicProgress count={selected.length} />
          {error ? <Text variant="small" style={{ color: colors.redDark, textAlign: 'center' }}>{error}</Text> : null}
          <Button label="Continue" icon="arrow-forward" onPress={save} disabled={!canContinue(selected)} loading={busy}
            accessibilityHint={canContinue(selected) ? undefined : 'Choose at least one category to continue'} />
        </View>
      }
    >
      <Text variant="label" style={{ color: colors.red, letterSpacing: 1, marginBottom: space.xs }}>STEP 2 OF 2</Text>
      <Header title="What support are you looking for?"
        subtitle="Choose the categories that matter to you — as many as you like. They personalise your feed, resources and suggestions, and you can change them later." />
      <View style={{ marginBottom: space.lg }}>
        <CapySays pose={capy.pose} message={capy.text} size={84} motion="pop" />
      </View>
      <TopicPicker selected={selected} onChange={setSelected} />
      <Notice text="Topics aren't used to score or assess you." icon="shield-checkmark-outline" />
    </Screen>
  );
}
