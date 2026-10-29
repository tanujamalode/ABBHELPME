import { router } from 'expo-router';
import { EmptyState, ErrorState, Header, Loading, Row, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { space } from '@/constants/brand';
import { GROUP_META } from '@/lib/resourceMeta';
import { decodePreset, presetLabel } from '@/lib/wellness';
import { useData } from '@/state/useData';

/** My Saves: posts, resources, meditation sessions and conversations kept for later. Only you can see them. */
export default function Saved() {
  const { data, loading, error, reload } = useData(async (r) => {
    const bms = await r.listBookmarks();
    const postIds = bms.filter((b) => b.type === 'post').map((b) => b.itemId);
    const [postsRaw, resourcesRaw, conversations, meta] = await Promise.all([
      Promise.all(postIds.map((id) => r.getPost(id))),
      Promise.all(bms.filter((b) => b.type === 'resource').map((b) => r.getResource(b.itemId))),
      r.listConversations(),
      r.getPostMeta(postIds),
    ]);
    const savedConv = new Set(bms.filter((b) => b.type === 'conversation').map((b) => b.itemId));
    const sessions = bms.filter((b) => b.type === 'session')
      .map((b) => ({ key: b.itemId, preset: decodePreset(b.itemId) })).filter((s) => !!s.preset);
    return {
      posts: postsRaw.filter((p) => !!p), resources: resourcesRaw.filter((x) => !!x), meta, sessions,
      conversations: conversations.filter((c) => savedConv.has(c.id)),
    };
  });
  const empty = !!data && data.posts.length + data.resources.length + data.sessions.length + data.conversations.length === 0;
  return (
    <Screen>
      <Header title="My Saves" back subtitle="Only you can see what you save." />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : empty ? (
        <EmptyState capy="winking" title="Nothing saved yet" text="Tap the bookmark on a post or resource, save a meditation, or save a conversation from its menu." />
      ) : (
        <>
          {data!.resources.length ? <Text variant="h2" style={{ marginBottom: space.sm }}>Resources</Text> : null}
          {data!.resources.map((r) => r && (
            <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={r.subtitle}
              onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })} />
          ))}
          {data!.sessions.length ? <Text variant="h2" style={{ marginVertical: space.sm }}>Meditation & breathing</Text> : null}
          {data!.sessions.map((s) => s.preset && (
            <Row key={s.key} icon="leaf-outline" accent="green" title={presetLabel(s.preset)} subtitle="Tap to start"
              onPress={() => router.push({ pathname: '/meditate', params: { preset: s.key } })} />
          ))}
          {data!.conversations.length ? <Text variant="h2" style={{ marginVertical: space.sm }}>Conversations</Text> : null}
          {data!.conversations.map((c) => (
            <Row key={c.id} icon="chatbubble-ellipses-outline" accent="blue" title={c.otherName ?? c.otherAlias} subtitle={c.lastBody ?? undefined}
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} />
          ))}
          {data!.posts.length ? <Text variant="h2" style={{ marginVertical: space.sm }}>Posts</Text> : null}
          {data!.posts.map((p) => p && <PostCard key={p.id} post={p} meta={data!.meta[p.id]} compact />)}
        </>
      )}
    </Screen>
  );
}
