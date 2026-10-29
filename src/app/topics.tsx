import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Header, Loading, Notice, Screen, Text } from '@/components/ui';
import { TopicPicker, TopicProgress } from '@/components/TopicPicker';
import { colors, space } from '@/constants/brand';
import { canContinue } from '@/lib/topics';
import { useApp } from '@/state/AppProvider';

export default function EditTopics() {
  const { repo, bump } = useApp();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { repo.getSelectedTopicIds().then(setSelected); }, [repo]);
  if (!selected) return <Screen><Loading /></Screen>;

  const save = async () => {
    setBusy(true); setErr(null);
    try { await repo.saveSelectedTopicIds(selected); bump(); router.back(); }
    catch { setErr('Could not save. Check your internet connection and try again.'); setBusy(false); }
  };

  return (
    <Screen
      footer={
        <View style={{ padding: space.lg, gap: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TopicProgress count={selected.length} />
          {err ? <Text variant="small" style={{ color: colors.redDark }}>{err}</Text> : null}
          <Button label="Save topics" onPress={save} disabled={!canContinue(selected)} loading={busy} />
        </View>
      }
    >
      <Header title="Your categories" back subtitle="Choose the categories that matter to you." />
      <TopicPicker selected={selected} onChange={setSelected} />
      <Notice text="Topics personalise your feed and suggestions. They aren't used to score or assess you." icon="shield-checkmark-outline" />
    </Screen>
  );
}
