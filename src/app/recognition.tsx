import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Field, Header, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import { SHOUTOUT_BADGES, type ShoutoutBadge } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { isAllowedEmail } from '@/lib/emailPolicy';
import { confirmContent } from '@/lib/confirmContent';
import { BADGE_META, badgeTally } from '@/lib/recognition';
import { timeAgo } from '@/lib/time';
import { isValidEmail } from '@/lib/verification';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

type Tab = 'give' | 'received' | 'wall';

/**
 * Peer appreciation. No leaderboards and no totals between people: just badges you can give and receive,
 * and a wall of the ones recipients chose to share.
 */
export default function Recognition() {
  const { repo, bump } = useApp();
  const [tab, setTab] = useState<Tab>('give');
  const [email, setEmail] = useState('');
  const [badge, setBadge] = useState<ShoutoutBadge>('thanks');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { data, loading, error, reload } = useData(async (r) => {
    const [mine, wall] = await Promise.all([r.listMyShoutouts(), r.listShoutoutWall()]);
    return { mine, wall };
  });

  const send = () => {
    if (!isValidEmail(email) || !isAllowedEmail(email)) { setProblem('Enter your colleague\'s Outlook, Hotmail, Live or ABB email address.'); return; }
    if (!message.trim()) { setProblem('Write a short message.'); return; }
    confirmContent(message, () => { void deliver(); });
  };

  const deliver = async () => {
    setProblem(null); setBusy(true);
    const ok = await attempt(async () => { await repo.giveShoutout(email.trim(), badge, message.trim(), anonymous); return true; }, 'send your shout-out');
    setBusy(false);
    if (ok) {
      setEmail(''); setMessage(''); bump();
      // The same words are shown whether or not the address belongs to a colleague.
      Alert.alert('Shout-out sent', 'If that colleague uses ABB Help Me, they will see it in their notifications. Check the address if you are unsure.');
    }
  };

  const tally = badgeTally(data?.mine ?? []);

  return (
    <Screen>
      <Header title="Recognition" back subtitle="Say thanks. Celebrate each other." />
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        <Chip label="Give" selected={tab === 'give'} onPress={() => setTab('give')} />
        <Chip label={`Received${data?.mine.length ? ` (${data.mine.length})` : ''}`} selected={tab === 'received'} onPress={() => setTab('received')} />
        <Chip label="Wall" selected={tab === 'wall'} onPress={() => setTab('wall')} />
      </View>

      {tab === 'give' ? (
        <>
          <Text variant="h3" style={{ marginBottom: space.sm }}>Choose a badge</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg }}>
            {SHOUTOUT_BADGES.map((b) => <Chip key={b} label={BADGE_META[b].label} selected={badge === b} onPress={() => setBadge(b)} />)}
          </View>
          <Text variant="small" style={{ marginTop: -space.sm, marginBottom: space.md }}>{BADGE_META[badge].blurb}</Text>
          <Field label="Colleague's email" value={email} onChangeText={(t) => { setEmail(t); setProblem(null); }} keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false} placeholder="name@abb.com" hint="Used once to deliver it. It is not stored with the shout-out." />
          <Field label="Your message" value={message} onChangeText={(t) => { setMessage(t); setProblem(null); }} multiline maxLength={200}
            placeholder="Thank you for staying late to help with the release" hint={`${message.length}/200`} error={problem} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.lg }}>
            <View style={{ flex: 1, paddingRight: space.md }}>
              <Text variant="h3" style={{ fontSize: 14 }}>Send anonymously</Text>
              <Text variant="small">{anonymous ? 'They will not see your name.' : 'They will see the display name from your profile.'}</Text>
            </View>
            <Switch value={anonymous} onValueChange={setAnonymous} accessibilityLabel="Send anonymously" trackColor={{ true: colors.red, false: colors.border }} />
          </View>
          <Button label="Send shout-out" icon="ribbon-outline" onPress={send} loading={busy} />
          <Notice text="Up to 10 a day. Recipients choose whether a shout-out appears on the wall. There are no rankings or totals between colleagues." icon="heart-outline" />
        </>
      ) : loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : tab === 'received' ? (
        !data?.mine.length ? <EmptyState capy="hi" title="No shout-outs yet" text="When a colleague thanks you, it appears here." /> : (
          <>
            {tally.length ? (
              <Card style={{ marginBottom: space.md }}>
                <Text variant="label" style={{ marginBottom: space.sm }}>YOUR BADGES</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                  {tally.map((t) => (
                    <View key={t.badge} style={{ alignItems: 'center', width: 76 }} accessible accessibilityLabel={`${BADGE_META[t.badge].label}, ${t.count}`}>
                      <IconTile icon={BADGE_META[t.badge].icon} accent={BADGE_META[t.badge].accent} size={44} />
                      <Text variant="small" style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={2}>{BADGE_META[t.badge].label}</Text>
                      <Text variant="h3" style={{ fontSize: 13 }}>×{t.count}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}
            {data.mine.map((s) => (
              <Card key={s.id} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <IconTile icon={BADGE_META[s.badge].icon} accent={BADGE_META[s.badge].accent} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text variant="h3">{BADGE_META[s.badge].label}</Text>
                    <Text variant="body" style={{ marginTop: 2 }}>{s.message}</Text>
                    <Text variant="small" style={{ marginTop: 4 }}>{s.fromName ? `From ${s.fromName}` : 'From a colleague'} · {timeAgo(s.createdAt)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
                  <Text variant="small" style={{ flex: 1 }}>Show on the wall (with your display name)</Text>
                  <Switch value={s.shared} accessibilityLabel="Show on the wall" trackColor={{ true: colors.red, false: colors.border }}
                    onValueChange={(v) => { void attempt(async () => { await repo.shareShoutout(s.id, v); bump(); reload(); }); }} />
                </View>
              </Card>
            ))}
          </>
        )
      ) : (
        !data?.wall.length ? <EmptyState capy="cheerful" title="The wall is empty" text="Shout-outs that recipients choose to share appear here." /> : data.wall.map((s) => (
          <Card key={s.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <IconTile icon={BADGE_META[s.badge].icon} accent={BADGE_META[s.badge].accent} size={42} />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{s.toName ?? 'A colleague'} · {BADGE_META[s.badge].label}</Text>
                <Text variant="body" style={{ marginTop: 2 }}>{s.message}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <Badge label={s.fromName ? `From ${s.fromName}` : 'From a colleague'} tone="neutral" />
                  <Text variant="small">{timeAgo(s.createdAt)}</Text>
                </View>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
