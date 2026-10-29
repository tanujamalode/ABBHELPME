import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, Header, IconTile, Notice, Screen, Text } from '@/components/ui';
import { space } from '@/constants/brand';
import { MICRO_BREAKS, breakSeconds, wellnessProgress } from '@/lib/wellness';
import { useData } from '@/state/useData';

/** Short activities for the middle of a working day. */
export default function MicroBreaks() {
  const { data } = useData(async (r) => wellnessProgress(await r.listSessions()));
  return (
    <Screen>
      <Header title="Micro-breaks" back subtitle="A minute or two to refresh your mind and body." />
      {data?.resetsCompleted ? (
        <View style={{ flexDirection: 'row', marginBottom: space.md }}>
          <Badge label={`${data.resetsCompleted} ${data.resetsCompleted === 1 ? 'reset' : 'resets'} completed`} tone="ok" />
        </View>
      ) : null}
      {MICRO_BREAKS.map((b) => {
        const mins = Math.max(1, Math.round(breakSeconds(b) / 60));
        return (
          <Card key={b.id} onPress={() => router.push({ pathname: '/microbreak/[id]', params: { id: b.id } })}
            accessibilityLabel={`${b.title}, about ${mins} minutes`} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconTile icon={b.icon} accent={b.accent} size={46} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{b.title}</Text>
                <Text variant="small">{b.blurb}</Text>
              </View>
              <Badge label={`${mins} min`} tone="neutral" />
            </View>
          </Card>
        );
      })}
      <Notice text="Hydration and break reminders can be switched on in Notifications. Stop if anything hurts." />
    </Screen>
  );
}
