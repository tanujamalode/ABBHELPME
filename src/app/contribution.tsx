import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Capy } from '@/components/Capy';
import { DEMO_MODE } from '@/constants/demo';
import { Badge, Card, Header, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { accents, colors, radius, space, shadow } from '@/constants/brand';
import { tierLine } from '@/lib/capy';
import { DAILY_ACTIVITY_CAP, POINTS, TIERS } from '@/lib/karma';
import { useContribution } from '@/state/useContribution';

const RULES: { label: string; pts: number; phase2?: boolean }[] = [
  { label: 'Your answer is accepted', pts: POINTS.acceptedAnswer, phase2: true },
  { label: 'Answer a work question', pts: POINTS.answer },
  { label: 'Share an achievement', pts: POINTS.achievement },
  { label: 'Ask a work question', pts: POINTS.question },
  { label: 'Leave a supportive comment', pts: POINTS.supportComment },
  { label: 'Upvote from a colleague', pts: POINTS.upvoteReceived, phase2: true },
  { label: 'Downvote (with a reason)', pts: POINTS.downvoteReceived, phase2: true },
];

export default function ContributionScreen() {
  const { data: c, loading } = useContribution();
  if (loading || !c) return <Screen><Header title="Contribution" back /><Loading /></Screen>;

  return (
    <Screen>
      <Header title="Contribution" back subtitle="Rewards helping others — not popularity." />

      <View style={styles.hero} accessible accessibilityLabel={`Contribution score ${c.score}. Tier ${c.tier.label}.`}>
        <View style={styles.tierIcon}><Capy pose={tierLine(c.tier.id).pose} size={80} motion="pop" /></View>
        <Text style={{ color: '#fff', fontWeight: '600', marginTop: space.md, textAlign: 'center' }}>{tierLine(c.tier.id).text}</Text>
        <Text style={{ color: '#C9D1E2', fontWeight: '700', letterSpacing: 1, fontSize: 12, marginTop: space.md }}>{c.tier.label.toUpperCase()}</Text>
        <Text style={{ color: '#fff', fontSize: 44, fontWeight: '800', lineHeight: 50 }}>{c.score}</Text>
        <Text style={{ color: '#C9D1E2' }}>contribution points</Text>
        {c.next ? (
          <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(c.progress * 100)}%` }]} /></View>
            <Text style={{ color: '#C9D1E2', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
              {c.next.min - c.score} points to {c.next.label}
            </Text>
          </View>
        ) : <Text style={{ color: '#fff', marginTop: space.md }}>Top tier reached. Thank you!</Text>}
      </View>

      {c.topCategory ? (
        <View style={{ flexDirection: 'row', marginBottom: space.md }}><Badge label={`Active helper in ${c.topCategory}`} tone="ok" /></View>
      ) : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Tiers</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xl }}>
        {TIERS.map((t) => {
          const reached = c.score >= t.min;
          return (
            <View key={t.id} style={{ alignItems: 'center', width: '19%' }} accessible accessibilityLabel={`${t.label}, ${t.min} points${reached ? ', reached' : ''}`}>
              <View style={[styles.tierDot, reached && { backgroundColor: accents.rose.bg, borderColor: colors.red }]}>
                <Ionicons name={t.icon} size={18} color={reached ? colors.red : colors.muted} />
              </View>
              <Text variant="label" style={{ textAlign: 'center', marginTop: 4, color: reached ? colors.navy : colors.muted }} numberOfLines={2}>{t.label}</Text>
              <Text variant="small" style={{ fontSize: 11 }}>{t.min}</Text>
            </View>
          );
        })}
      </View>

      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Where your points come from</Text>
      <Card style={{ marginBottom: space.xl }}>
        {c.breakdown.map((b, i) => (
          <View key={b.label} style={[styles.line, i === c.breakdown.length - 1 && { borderBottomWidth: 0 }]}>
            <Text variant="body" style={{ flex: 1 }}>{b.label}</Text>
            <Text variant="small" style={{ marginRight: space.md }}>×{b.count}</Text>
            <Text variant="h3" style={{ minWidth: 36, textAlign: 'right' }}>{b.points}</Text>
          </View>
        ))}
      </Card>
      {c.cappedDays ? <Notice text={`The daily limit of ${DAILY_ACTIVITY_CAP} activity points applied on ${c.cappedDays} day(s).`} /> : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>How points work</Text>
      <Card style={{ marginBottom: space.md }}>
        {RULES.map((r, i) => (
          <View key={r.label} style={[styles.line, i === RULES.length - 1 && { borderBottomWidth: 0 }]}>
            <IconTile icon={r.pts > 0 ? 'add' : 'remove'} accent={r.pts > 0 ? 'green' : 'slate'} size={28} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text variant="body">{r.label}</Text>
              {r.phase2 ? <Text variant="small">Arrives with the shared community</Text> : null}
            </View>
            <Text variant="h3">{r.pts > 0 ? `+${r.pts}` : r.pts}</Text>
          </View>
        ))}
      </Card>
      <Notice icon="shield-checkmark-outline"
        text={`Your score is never used in performance reviews and isn't linked to your name. Votes on your own posts and answers to your own questions don't count, and activity points are capped at ${DAILY_ACTIVITY_CAP} a day.`} />
      <Notice text={DEMO_MODE
        ? 'Prototype: includes sample history and sample votes from colleagues (18 up, 1 down, 1 accepted answer). Real votes arrive with the shared community.'
        : 'This version only knows activity on this device. Upvotes and accepted answers from colleagues will count once the shared community launches.'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.navy, marginBottom: space.lg, ...shadow },
  tierIcon: { width: 104, height: 104, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#ffffff26', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.red },
  tierDot: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
