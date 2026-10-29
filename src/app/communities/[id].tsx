import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Chip, EmptyState, ErrorState, Header, IconButton, Loading, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { colors, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const PAGE = 8;

/** One community: follow it, read what colleagues posted there, and post to it. */
export default function CommunityPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, bump } = useApp();
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const [shown, setShown] = useState(PAGE);
  const { data, loading, error, reload } = useData(async (r) => {
    const [communities, posts] = await Promise.all([r.listCommunities(), r.listPosts(undefined, String(id))]);
    const meta = await r.getPostMeta(posts.map((p) => p.id));
    return { community: communities.find((c) => c.id === id) ?? null, posts, meta };
  }, [id]);

  if (loading) return <Screen><Header title="Community" back /><Loading /></Screen>;
  if (error) return <Screen><Header title="Community" back /><ErrorState text={error} onRetry={reload} /></Screen>;
  if (!data?.community) return <Screen><Header title="Community" back /><EmptyState capy="surprised" title="Community not found" /></Screen>;

  const { community, posts, meta } = data;
  const list = sort === 'new' ? posts : [...posts].sort((a, b) => (meta[b.id]?.score ?? 0) - (meta[a.id]?.score ?? 0) || b.createdAt - a.createdAt);

  return (
    <Screen>
      <Header title={community.name} back subtitle={community.description}
        right={<IconButton icon="add-circle" label="Post in this community"
          onPress={() => router.push({ pathname: '/compose', params: { community: community.id, type: 'discussion' } })} />} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
        <Badge label={`${community.members} ${community.members === 1 ? 'member' : 'members'}`} tone="neutral" />
        <View style={{ flex: 1 }} />
        <Button label={community.following ? 'Following' : 'Follow'} variant={community.following ? 'secondary' : 'primary'}
          icon={community.following ? 'checkmark' : 'add'}
          onPress={() => { void attempt(async () => { await repo.setFollowing(community.id, !community.following); bump(); }); }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Chip label="Newest" selected={sort === 'new'} onPress={() => setSort('new')} />
        <Chip label="Trending" selected={sort === 'top'} onPress={() => setSort('top')} />
      </View>
      {list.length === 0 ? (
        <EmptyState capy="headphones" title="Quiet here so far" text="Start a conversation in this community."
          action={<Button label="New post" onPress={() => router.push({ pathname: '/compose', params: { community: community.id, type: 'discussion' } })} />} />
      ) : (
        <View>
          {list.slice(0, shown).map((p) => <PostCard key={p.id} post={p} meta={meta[p.id]} />)}
          {shown < list.length ? <Text variant="h3" style={{ color: colors.red, textAlign: 'center', padding: space.md }} accessibilityRole="button"
            onPress={() => setShown((n) => n + PAGE)}>Load more</Text> : null}
        </View>
      )}
    </Screen>
  );
}
