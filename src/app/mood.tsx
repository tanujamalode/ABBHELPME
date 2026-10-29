import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { MoodChart } from '@/components/MoodChart';
import { Button, Card, Chip, EmptyState, Header, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';
import { DEMO_MODE } from '@/constants/demo';
import { MoodIcon } from '@/components/MoodIcon';
import { MOOD_LABEL, TAG_LABEL, WEEKDAY, periodStats } from '@/lib/moodStats';
import { useData } from '@/state/useData';

export default function MoodTrends() {
  const [range, setRange] = useState<7 | 30>(7);
  const { data: moods, loading } = useData((r) => r.listMoodCheckins());
  if (loading || !moods) return <Screen><Header title="Mood trends" back /><Loading /></Screen>;

  const s = periodStats(moods, range);
  const deltaText = s.delta == null ? null
    : Math.abs(s.delta) < 0.15 ? 'About the same as the previous period'
    : s.delta > 0 ? 'A bit brighter than the previous period' : 'A bit lower than the previous period';

  return (
    <Screen>
      <Header title="Mood trends" back subtitle="Your personal check-ins on this device." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}>
        <Chip label="This week" selected={range === 7} onPress={() => setRange(7)} />
        <Chip label="Last 30 days" selected={range === 30} onPress={() => setRange(30)} />
      </ScrollView>

      {moods.length === 0 ? (
        <EmptyState capy="hi" title="No check-ins yet" text="A one-tap check-in on the Well-being tab starts your trend."
          action={<Button label="Check in now" onPress={() => router.push('/wellbeing')} />} />
      ) : (
        <>
          {/* Headline numbers: stat tiles, not a chart */}
          <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
            <Card style={{ flex: 1 }} accessibilityLabel={`Average mood: ${s.averageMood ? MOOD_LABEL[s.averageMood] : 'none'}`}>
              <Text variant="label">AVERAGE</Text>
              <View style={{ marginVertical: 6 }}>{s.averageMood ? <MoodIcon mood={s.averageMood} size={40} /> : <Text style={{ fontSize: 28 }}>—</Text>}</View>
              <Text variant="h3">{s.averageMood ? MOOD_LABEL[s.averageMood] : 'No data'}</Text>
            </Card>
            <Card style={{ flex: 1 }} accessibilityLabel={`Checked in on ${s.checkinDays} of ${range} days`}>
              <Text variant="label">CHECK-IN DAYS</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', marginTop: 4 }}>{s.checkinDays}<Text variant="small"> / {range}</Text></Text>
              <Text variant="small">No streaks — every check-in counts.</Text>
            </Card>
          </View>

          <Card style={{ marginBottom: space.md }}>
            <Text variant="h3" accessibilityRole="header" style={{ marginBottom: space.sm }}>
              {range === 7 ? 'Your week' : 'Your month'}
            </Text>
            <MoodChart days={s.days} />
            {deltaText ? <Text variant="small" style={{ marginTop: space.md }}>{deltaText}.</Text> : null}
          </Card>

          <Text variant="h2" accessibilityRole="header" style={{ marginVertical: space.sm }}>What we noticed</Text>
          {s.toughDayTag ? (
            <Insight icon="analytics-outline" text={`${s.toughDayTag.count} of your ${s.toughDayTag.of} lower check-ins were tagged “${TAG_LABEL[s.toughDayTag.tag]}”.`} />
          ) : null}
          {s.bestWeekday != null ? <Insight icon="sunny-outline" text={`${WEEKDAY[s.bestWeekday]}s tend to be your best days.`} /> : null}
          {s.topTags.length ? (
            <Insight icon="pricetags-outline" text={`Most tagged: ${s.topTags.map((t) => `${TAG_LABEL[t.tag]} (${t.count})`).join(', ')}.`} />
          ) : <Insight icon="pricetags-outline" text="Add tags when you check in to see what shapes your days." />}
          {s.toughDayTag?.tag === 'workload' ? (
            <Button label="Ideas for managing workload" variant="secondary" icon="leaf-outline"
              onPress={() => router.push({ pathname: '/resource/[id]', params: { id: 'r-balance' } })} style={{ marginTop: space.sm }} />
          ) : null}
        </>
      )}
      {DEMO_MODE ? <Notice tone="warn" icon="flask-outline" text="Prototype: this history is sample data created when you signed up." /> : null}
      <Notice icon="eye-off-outline" text="Only you can see this. Check-ins stay on this device, are never shared with HR or managers, and don't trigger any alert." />
    </Screen>
  );
}

function Insight({ icon, text }: { icon: React.ComponentProps<typeof IconTile>['icon']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm }}>
      <IconTile icon={icon} accent="violet" size={36} />
      <Text variant="body" style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}
