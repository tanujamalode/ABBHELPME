import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Capy } from '@/components/Capy';
import { Button, Card, Text } from '@/components/ui';
import { accents, colors, space } from '@/constants/brand';
import type { ModerationResult } from '@/lib/moderation';

const TONE = {
  block: { icon: 'close-circle', color: colors.redDark },
  warn: { icon: 'alert-circle', color: accents.amber.fg },
  support: { icon: 'heart-circle', color: accents.rose.fg },
} as const;

/**
 * Shown in place of saving when the on-device check finds something.
 * Blocks only for attacks and confidential info; everything else can be posted after review.
 */
export function ModerationReview({ result, onEdit, onPostAnyway, busy }: {
  result: ModerationResult; onEdit: () => void; onPostAnyway: () => void; busy?: boolean;
}) {
  const support = result.issues.some((i) => i.severity === 'support');
  return (
    <Card style={{ marginBottom: space.lg, borderColor: result.ok ? accents.amber.bg : '#F5B8C2' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
        <Capy pose={support ? 'support' : result.ok ? 'thinking' : 'concerned'} size={72} motion="pop" />
        <View style={{ flex: 1 }}>
          <Text variant="h3" accessibilityRole="header">{support ? 'Cappy is here for you' : 'Before you post'}</Text>
          <Text variant="small">
            {support ? 'Your post can still go up. ' : ''}A quick check on this device spotted something. Nothing has been sent anywhere.
          </Text>
        </View>
      </View>
      {result.issues.map((i) => (
        <View key={i.kind} style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }} accessible
          accessibilityLabel={`${i.title}. ${i.detail}`}>
          <Ionicons name={TONE[i.severity].icon} size={20} color={TONE[i.severity].color} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text variant="h3" style={{ fontSize: 14 }}>{i.title}</Text>
            <Text variant="small">{i.detail}</Text>
          </View>
        </View>
      ))}
      <View style={{ gap: space.sm }}>
        {support ? <Button label="See support options" icon="heart-outline" variant="secondary" onPress={() => router.push('/resource/r-urgent')} /> : null}
        <Button label="Edit my text" onPress={onEdit} />
        {result.ok ? <Button label="Post anyway" variant="ghost" onPress={onPostAnyway} loading={busy} /> : (
          <Text variant="small" style={{ textAlign: 'center', color: colors.redDark }}>Please edit the highlighted parts to continue.</Text>
        )}
      </View>
    </Card>
  );
}
