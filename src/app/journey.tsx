import { View } from 'react-native';
import { router } from 'expo-router';
import { MoodIcon } from '@/components/MoodIcon';
import { Badge, Button, Card, ErrorState, Header, IconTile, Loading, Notice, Row, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import { MOOD_LABEL } from '@/lib/moodStats';
import { BADGE_META, badgeTally } from '@/lib/recognition';
import { TOPIC_CATALOGUE } from '@/lib/topics';
import { timeAgo } from '@/lib/time';
import { wellnessProgress } from '@/lib/wellness';
import { useData } from '@/state/useData';

/** My Wellbeing Journey: everything you have done for yourself, in one private place. */
export default function Journey() {
  const { data, loading, error, reload } = useData(async (r) => {
    const [moods, sessions, bookmarks, topics, communities, conversations, shoutouts] = await Promise.all([
      r.listMoodCheckins(), r.listSessions(), r.listBookmarks(), r.getSelectedTopicIds(), r.listCommunities(), r.listConversations(), r.listMyShoutouts(),
    ]);
    const savedIds = new Set(bookmarks.filter((b) => b.type === 'conversation').map((b) => b.itemId));
    return {
      moods, progress: wellnessProgress(sessions), topics, shoutouts,
      posts: bookmarks.filter((b) => b.type === 'post').length,
      resources: bookmarks.filter((b) => b.type === 'resource').length,
      sessionsSaved: bookmarks.filter((b) => b.type === 'session').length,
      following: communities.filter((c) => c.following),
      important: conversations.filter((c) => savedIds.has(c.id)),
    };
  });

  if (loading) return <Screen><Header title="My Wellbeing Journey" back /><Loading /></Screen>;
  if (error || !data) return <Screen><Header title="My Wellbeing Journey" back /><ErrorState text={error ?? 'Something went wrong.'} onRetry={reload} /></Screen>;

  const { moods, progress, topics, following, important, shoutouts } = data;
  const badges = badgeTally(shoutouts);

  return (
    <Screen>
      <Header title="My Wellbeing Journey" back subtitle="Your progress, at your pace. Only you can see this." />

      <Section title="Check-ins" action="Mood trends" onAction={() => router.push('/mood')}>
        {moods.length === 0 ? <Text variant="body">No check-ins yet. A one-tap check-in on the Well-being tab starts your story.</Text> : (
          <>
            <Text variant="small" style={{ marginBottom: space.sm }}>{moods.length} check-in{moods.length === 1 ? '' : 's'} so far. Latest:</Text>
            {moods.slice(0, 5).map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 }}>
                <MoodIcon mood={m.mood} size={28} />
                <Text variant="body" style={{ flex: 1 }}>{MOOD_LABEL[m.mood]}</Text>
                <Text variant="small">{timeAgo(m.createdAt)}</Text>
              </View>
            ))}
          </>
        )}
      </Section>

      <Section title="Meditation & breathing" action="Start" onAction={() => router.push('/meditate')}>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={progress.minutesThisWeek} label="MIN THIS WEEK" />
          <Stat value={progress.sessionsThisWeek} label="SESSIONS" />
          <Stat value={progress.minutesTotal} label="MIN ALL TIME" />
        </View>
      </Section>

      <Section title="Reset sessions" action="Take a break" onAction={() => router.push('/microbreaks')}>
        <Text variant="body">{progress.resetsCompleted ? `${progress.resetsCompleted} micro-break${progress.resetsCompleted === 1 ? '' : 's'} completed.` : 'No micro-breaks yet. Even one minute helps.'}</Text>
      </Section>

      <Section title="Saved" action="Open My Saves" onAction={() => router.push('/saved')}>
        <View style={{ flexDirection: 'row' }}>
          <Stat value={data.posts} label="POSTS" />
          <Stat value={data.resources} label="RESOURCES" />
          <Stat value={data.sessionsSaved} label="SESSIONS" />
        </View>
      </Section>

      <Section title="What you follow" action="Change" onAction={() => router.push('/topics')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {topics.length ? topics.map((t) => <Badge key={t} label={TOPIC_CATALOGUE.find((x) => x.id === t)?.label ?? t} tone="neutral" />)
            : <Text variant="body">No categories chosen yet.</Text>}
        </View>
        <Text variant="small" style={{ marginTop: space.md, marginBottom: 6 }}>Communities</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {following.length ? following.map((c) => <Badge key={c.id} label={c.name} tone="ok" />) : <Text variant="body">Not following any yet.</Text>}
        </View>
        <Button label="Browse communities" variant="ghost" onPress={() => router.push('/communities')} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
      </Section>

      <Section title="Important conversations" action="Messages" onAction={() => router.push('/messages')}>
        {important.length ? important.map((c) => (
          <Row key={c.id} icon="chatbubble-ellipses-outline" accent="blue" title={c.otherName ?? c.otherAlias} subtitle={c.lastBody ?? undefined}
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} />
        )) : <Text variant="body">Save a conversation from its menu to keep it here.</Text>}
      </Section>

      {badges.length ? (
        <Section title="Recognition you have received" action="Recognition" onAction={() => router.push('/recognition')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {badges.map((t) => (
              <View key={t.badge} style={{ alignItems: 'center', width: 72 }}>
                <IconTile icon={BADGE_META[t.badge].icon} accent={BADGE_META[t.badge].accent} size={42} />
                <Text variant="small" style={{ fontSize: 11, textAlign: 'center' }} numberOfLines={2}>{BADGE_META[t.badge].label} ×{t.count}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
      <Notice icon="lock-closed-outline" text="Your journey has no scores, streaks or rankings. It is just a record for you." />
    </Screen>
  );
}

function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Text variant="h2" accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
        {action && onAction ? <Text variant="h3" style={{ color: colors.red }} accessibilityRole="link" onPress={onAction}>{action}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>{value}</Text>
      <Text variant="label" style={{ fontSize: 10 }}>{label}</Text>
    </View>
  );
}
