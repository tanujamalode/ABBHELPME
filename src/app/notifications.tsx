import { useEffect, useRef } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Card, EmptyState, ErrorState, Header, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { colors, space, type Accent } from '@/constants/brand';
import type { NotificationKind } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { syncReminders } from '@/lib/reminders';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const KIND: Record<NotificationKind, { icon: IconName; accent: Accent }> = {
  answer: { icon: 'chatbubble-ellipses', accent: 'blue' },
  comment: { icon: 'chatbubble', accent: 'rose' },
  accepted: { icon: 'checkmark-circle', accent: 'green' },
  shoutout: { icon: 'ribbon', accent: 'amber' },
};

export default function Notifications() {
  const { repo, bump } = useApp();
  const inbox = useData((r) => r.listNotifications());
  const { data, loading } = useData((r) => r.getNotificationPrefs());

  // Opening the inbox marks everything read, once the list has loaded.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !inbox.data?.some((n) => !n.read)) return;
    marked.current = true;
    repo.markNotificationsRead().then(bump).catch(() => { marked.current = false; });
  }, [inbox.data, repo, bump]);

  const set = async (patch: Partial<NonNullable<typeof data>>) => {
    if (!data) return;
    const next = { ...data, ...patch };
    const saved = await attempt(async () => { await repo.setNotificationPrefs(next); bump(); return true; });
    if (!saved) return;
    const result = await syncReminders(next);
    if (result === 'denied') {
      Alert.alert('Notifications are off', 'Allow notifications for this app in your phone settings to get reminders.', [
        { text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } },
      ]);
    }
  };
  const items = [
    { key: 'dailyReminder' as const, title: 'Gentle check-in reminder', sub: 'A once-a-day nudge at 4 pm to take a moment for yourself.' },
    { key: 'microBreak' as const, title: 'Micro-break nudges', sub: 'Two short reminders a day, at 11 am and 3 pm.' },
    { key: 'hydration' as const, title: 'Hydration reminders', sub: 'A glass of water at 10, 12, 2 and 4.' },
    { key: 'resourceTips' as const, title: 'Resource tips', sub: 'A weekly pointer to your saved resources.' },
  ];

  return (
    <Screen>
      <Header title="Notifications" back />
      <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Inbox</Text>
      {inbox.loading ? <Loading /> : inbox.error ? <ErrorState text={inbox.error} onRetry={inbox.reload} /> : !inbox.data?.length ? (
        <EmptyState capy="calm" title="Nothing new" text="You will see a note here when someone answers your question or accepts your answer." />
      ) : inbox.data.map((n) => (
        <Card key={n.id}
          onPress={n.postId ? () => router.push({ pathname: '/post/[id]', params: { id: n.postId! } })
            : n.kind === 'shoutout' ? () => router.push('/recognition') : undefined}
          accessibilityLabel={`${n.title}. ${n.body}`} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <IconTile icon={KIND[n.kind].icon} accent={KIND[n.kind].accent} size={42} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{n.title}</Text>
              <Text variant="small" style={{ marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                {!n.read ? <Badge label="New" tone="ok" /> : null}
                <Text variant="small">{timeAgo(n.createdAt)}</Text>
              </View>
            </View>
          </View>
        </Card>
      ))}

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.lg, marginBottom: space.sm }}>Reminders</Text>
      <Notice text="Reminders are scheduled on this phone only. Nothing is sent from a server, and turning one off cancels it. Replies and shout-outs appear in the inbox above." />
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
