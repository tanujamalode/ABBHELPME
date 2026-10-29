import { router } from 'expo-router';
import { EmptyState, ErrorState, Header, Loading, Row, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { space } from '@/constants/brand';
import { GROUP_META } from '@/lib/resourceMeta';
import { useData } from '@/state/useData';

export default function Saved() {
  const { data, loading, error, reload } = useData(async (r) => {
    const bms = await r.listBookmarks();
    const posts = (await Promise.all(bms.filter((b) => b.type === 'post').map((b) => r.getPost(b.itemId)))).filter((p) => !!p);
    const resources = (await Promise.all(bms.filter((b) => b.type === 'resource').map((b) => r.getResource(b.itemId)))).filter((x) => !!x);
    return { posts, resources };
  });
  const empty = !!data && data.posts.length + data.resources.length === 0;
  return (
    <Screen>
      <Header title="Saved" back subtitle="Bookmarks are stored on this device." />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : empty ? (
        <EmptyState capy="winking" title="Nothing saved yet" text="Tap the bookmark on a post or resource to keep it here." />
      ) : (
        <>
          {data!.resources.length ? <Text variant="h2" style={{ marginBottom: space.sm }}>Resources</Text> : null}
          {data!.resources.map((r) => r && (
            <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={r.subtitle}
              onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })} />
          ))}
          {data!.posts.length ? <Text variant="h2" style={{ marginVertical: space.sm }}>Posts</Text> : null}
          {data!.posts.map((p) => p && <PostCard key={p.id} post={p} compact />)}
        </>
      )}
    </Screen>
  );
}
