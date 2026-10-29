import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, Header, IconTile, Loading, Notice, Screen, Text, type IconName } from '@/components/ui';
import { space, type Accent } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

/** Join, leave and browse the communities. Trending ones (most new posts this week) come first in "Trending now". */
export default function Communities() {
  const { repo, bump } = useApp();
  const { data, loading, error, reload } = useData((r) => r.listCommunities());
  const trending = [...(data ?? [])].filter((c) => c.postsThisWeek > 0).sort((a, b) => b.postsThisWeek - a.postsThisWeek).slice(0, 3);

  const toggle = (id: string, follow: boolean) => {
    void attempt(async () => { await repo.setFollowing(id, follow); bump(); }, follow ? 'follow that community' : 'unfollow');
  };

  return (
    <Screen>
      <Header title="Communities" back subtitle="Follow the places that matter to you." />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState capy="thinking" title="No communities yet" />
      ) : (
        <>
          {trending.length ? (
            <>
              <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Trending now</Text>
              <Text variant="small" style={{ marginBottom: space.md }}>
                {trending.map((c) => `${c.name} (${c.postsThisWeek} new)`).join(' · ')}
              </Text>
            </>
          ) : null}
          <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>All communities</Text>
          {data.map((c) => (
            <Card key={c.id} onPress={() => router.push({ pathname: '/communities/[id]', params: { id: c.id } })}
              accessibilityLabel={`${c.name}. ${c.members} members. ${c.following ? 'Following' : 'Not following'}`} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <IconTile icon={c.icon as IconName} accent={c.accent as Accent} size={46} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{c.name}</Text>
                  <Text variant="small" numberOfLines={2}>{c.description}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Badge label={`${c.members} ${c.members === 1 ? 'member' : 'members'}`} tone="neutral" />
                    {c.postsThisWeek ? <Badge label={`${c.postsThisWeek} new this week`} tone="ok" /> : null}
                  </View>
                </View>
              </View>
              <Button label={c.following ? 'Following' : 'Follow'} variant={c.following ? 'secondary' : 'primary'}
                icon={c.following ? 'checkmark' : 'add'} onPress={() => toggle(c.id, !c.following)} style={{ marginTop: space.md }} />
            </Card>
          ))}
        </>
      )}
      <Notice text="Community leaders are colleagues who help look after a community. Their posts carry a Community leader badge." />
    </Screen>
  );
}
