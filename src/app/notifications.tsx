import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, Header, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { colors, space, type Accent } from '@/constants/brand';
import { DEMO_MODE } from '@/constants/demo';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const H = 3_600_000;
/** Mock inbox. Real in-app notifications need the shared community (Phase 2). */
const SAMPLE_INBOX: { id: string; icon: IconName; accent: Accent; title: string; body: string; ago: number; href: string }[] = [
  { id: 'n1', icon: 'chatbubble-ellipses', accent: 'blue', title: 'Someone answered your question', body: '“How do I request a second monitor?” has a new answer.', ago: 2 * H, href: '/community' },
  { id: 'n2', icon: 'checkmark-circle', accent: 'green', title: 'Your answer was accepted', body: 'Your VPN answer helped. You earned 15 points.', ago: 20 * H, href: '/contribution' },
  { id: 'n3', icon: 'bulb', accent: 'amber', title: 'Tip from Capy', body: 'Ten minutes outside between meetings can reset your day.', ago: 30 * H, href: '/resource/r-mindful' },
  { id: 'n4', icon: 'pulse', accent: 'violet', title: 'Your week in review', body: 'You checked in on 6 of 7 days. Nice rhythm.', ago: 52 * H, href: '/mood' },
];

export default function Notifications() {
  const { repo, bump } = useApp();
  const { data, loading } = useData((r) => r.getNotificationPrefs());
  const set = async (patch: Partial<NonNullable<typeof data>>) => { if (data) { await repo.setNotificationPrefs({ ...data, ...patch }); bump(); } };
  const items = [
    { key: 'dailyReminder' as const, title: 'Gentle check-in reminder', sub: 'A once-a-day nudge to take a moment for yourself.' },
    { key: 'resourceTips' as const, title: 'Resource tips', sub: 'Occasional pointers to saved resources.' },
  ];
  const [now] = useState(() => Date.now());
  return (
    <Screen>
      <Header title="Notifications" back />
      {DEMO_MODE ? (
        <>
          <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Inbox</Text>
          <Notice tone="warn" icon="flask-outline" text="Sample notifications for the prototype. Nothing here was sent by anyone." />
          {SAMPLE_INBOX.map((n) => (
            <Card key={n.id} onPress={() => router.push(n.href as never)} accessibilityLabel={`${n.title}. ${n.body}`} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <IconTile icon={n.icon} accent={n.accent} size={42} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{n.title}</Text>
                  <Text variant="small" style={{ marginTop: 2 }}>{n.body}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Badge label="Sample" tone="sample" />
                    <Text variant="small">{timeAgo(now - n.ago)}</Text>
                  </View>
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.sm }}>Reminders</Text>
      <Notice text="No notifications are sent in this version. These preferences are stored on this device for when local reminders are added. This app has no remote or push notifications." />
      {loading || !data ? <Loading /> : items.map((i) => (
        <View key={i.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="h3">{i.title}</Text>
            <Text variant="small">{i.sub}</Text>
          </View>
          <Switch value={data[i.key]} onValueChange={(v) => set({ [i.key]: v })} accessibilityLabel={i.title} trackColor={{ true: colors.red, false: colors.border }} />
        </View>
      ))}
    </Screen>
  );
}
