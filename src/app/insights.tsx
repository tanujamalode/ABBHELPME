import { useState } from 'react';
import { View } from 'react-native';
import { Card, Header, IconButton, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { colors, space, type Accent } from '@/constants/brand';
import { MoodIcon } from '@/components/MoodIcon';
import { MOOD_LABEL, TAG_LABEL } from '@/lib/moodStats';
import { moodShares } from '@/lib/pulse';
import { computeRecap } from '@/lib/recap';
import { monthLabel } from '@/lib/time';
import { useData } from '@/state/useData';

const BAR_COLORS = [colors.red, '#3B82F6', '#1E8E5A', '#F59E0B', '#8B5CF6'];

export default function Insights() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { data, loading } = useData(async (r) => {
    const [posts, bms, moods, topics, stats] = await Promise.all([
      r.listPosts(), r.listBookmarks(), r.listMoodCheckins(), r.getSelectedTopicIds(), r.getCommunityStats(30),
    ]);
    const pulse = await r.getOrgPulse(30);
    return { posts: posts.filter((p) => p.mine), bms, moods, topics, stats, pulse };
  });
  const shift = (d: number) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const recap = data ? computeRecap(data.posts, data.bms, data.moods, data.topics, ym.y, ym.m) : null;
  const stats = (data?.stats ?? []).slice(0, 5);
  const max = Math.max(1, ...stats.map((s) => s.count));

  return (
    <Screen>
      <Header title="Monthly Insights" back />
      <Text variant="h3" style={{ marginBottom: space.sm }}>Your personal recap</Text>
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
      <Notice text="This recap counts only your own activity. It has no scores, ratings or judgments, and nobody else can see it." icon="lock-closed-outline" />

      <View style={{ marginTop: space.xl }}>
        <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>How colleagues are feeling</Text>
        <Card style={{ marginBottom: space.xl }}>
          {data?.pulse ? (
            <>
              <Text variant="small" style={{ marginBottom: space.md }}>
                Anonymous check-ins from {data.pulse.people} colleagues over the last 30 days. Nothing is shown unless at least 5 people took part.
              </Text>
              {moodShares(data.pulse.moods).map((s) => (
                <View key={s.mood} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm }} accessible accessibilityLabel={`${MOOD_LABEL[s.mood]}, ${s.pct} percent`}>
                  <MoodIcon mood={s.mood} size={24} />
                  <Text variant="small" style={{ width: 78, color: colors.navy }}>{MOOD_LABEL[s.mood]}</Text>
                  <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.sand }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${s.pct}%`, backgroundColor: colors.red }} />
                  </View>
                  <Text variant="small" style={{ width: 36, textAlign: 'right', color: colors.navy, fontWeight: '700' }}>{s.pct}%</Text>
                </View>
              ))}
              {data.pulse.factors.length ? (
                <Text variant="small" style={{ marginTop: space.sm }}>
                  Most tagged factors: {data.pulse.factors.slice(0, 3).map((f) => TAG_LABEL[f.tag]).join(', ')}.
                </Text>
              ) : null}
            </>
          ) : <Text variant="body">Not enough check-ins yet to show a picture that protects anyone&apos;s privacy.</Text>}
        </Card>

        <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>What colleagues talked about</Text>
        <Card>
          <Text variant="small" style={{ marginBottom: space.md }}>
            Posts in the community over the last 30 days, by topic. Topics with fewer than 3 posts are not shown, so no one can be singled out.
          </Text>
          {stats.length === 0 ? <Text variant="body">Not enough activity yet.</Text> : stats.map((s, i) => (
            <View key={`${s.kind}:${s.category}`} style={{ marginBottom: space.md }} accessible accessibilityLabel={`${s.category}, ${s.count} posts`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="small" style={{ color: colors.navy }}>{s.category}</Text>
                <Text variant="small" style={{ color: colors.navy, fontWeight: '700' }}>{s.count}</Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sand, marginTop: 4 }}>
                <View style={{ height: 8, borderRadius: 4, width: `${(s.count / max) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
              </View>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
