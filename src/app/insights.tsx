import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Card, Header, IconButton, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { colors, space, type Accent } from '@/constants/brand';
import { computeRecap } from '@/lib/recap';
import { monthLabel } from '@/lib/time';
import { useData } from '@/state/useData';

const SAMPLE = [
  { label: 'Personal well-being', n: 79, color: colors.red }, { label: 'Workplace concerns', n: 59, color: '#3B82F6' },
  { label: 'Work-related doubts', n: 45, color: '#1E8E5A' }, { label: 'IT / technical', n: 30, color: '#F59E0B' }, { label: 'HR & policies', n: 20, color: '#8B5CF6' },
];

export default function Insights() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { data, loading } = useData(async (r) => {
    const [posts, bms, moods, topics] = await Promise.all([r.listPosts(), r.listBookmarks(), r.listMoodCheckins(), r.getSelectedTopicIds()]);
    return { posts, bms, moods, topics };
  });
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const recap = data ? computeRecap(data.posts, data.bms, data.moods, data.topics, ym.y, ym.m) : null;
  const max = Math.max(...SAMPLE.map((s) => s.n));

  return (
    <Screen>
      <Header title="Monthly Insights" back />
      <Text variant="h3" style={{ marginBottom: space.sm }}>Personal recap on this device</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => shift(-1)} />
        <Text variant="h2" accessibilityLiveRegion="polite">{monthLabel(ym.y, ym.m)}</Text>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => shift(1)} color={isCurrent ? colors.border : colors.navy} />
      </View>
      {loading || !recap ? <Loading /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[
            { label: 'Entries written', n: recap.entriesWritten, icon: 'create-outline', accent: 'rose' },
            { label: 'Resources saved', n: recap.resourcesSaved, icon: 'bookmark-outline', accent: 'blue' },
            { label: 'Mood check-ins', n: recap.moodCheckins, icon: 'happy-outline', accent: 'green' },
            { label: 'Topics you follow', n: recap.topicsExplored, icon: 'options-outline', accent: 'violet' },
          ].map((s) => (
            <Card key={s.label} style={{ width: '48.5%' }} accessibilityLabel={`${s.label}: ${s.n}`}>
              <IconTile icon={s.icon as IconName} accent={s.accent as Accent} size={40} />
              <Text style={{ fontSize: 30, fontWeight: '800', color: colors.navy, marginTop: space.xs }}>{s.n}</Text>
              <Text variant="small">{s.label}</Text>
            </Card>
          ))}
          <Card style={{ width: '100%' }}>
            <Text variant="h3">Your entries</Text>
            <Text variant="body" style={{ marginTop: 4 }}>
              {recap.personalEntries} personal · {recap.workQuestions} work questions · {recap.achievements} achievements
            </Text>
          </Card>
        </View>
      )}
      <Notice text="This recap counts only what's saved on this device. It has no scores, ratings or judgments, and nobody else can see it." icon="lock-closed-outline" />

      <View style={{ marginTop: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
          <Text variant="h2" accessibilityRole="header">Example organisation report</Text>
          <Badge label="Sample data" tone="sample" />
        </View>
        <Card>
          <Text variant="small" style={{ marginBottom: space.md }}>Illustration of how an organisation-wide report could look. Not real data and not built from your records.</Text>
          {SAMPLE.map((s) => (
            <View key={s.label} style={{ marginBottom: space.md }} accessible accessibilityLabel={`${s.label}, ${s.n} sample submissions`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" style={{ color: colors.navy }}>{s.label}</Text>
                <Text variant="small" style={{ color: colors.navy, fontWeight: '700' }}>{s.n}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sand, marginTop: 4 }}>
                <View style={{ height: 8, borderRadius: 4, width: `${(s.n / max) * 100}%`, backgroundColor: s.color }} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
