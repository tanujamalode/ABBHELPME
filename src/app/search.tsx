import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Badge, EmptyState, Field, Header, Loading, Row, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { space } from '@/constants/brand';
import { GROUP_META } from '@/lib/resourceMeta';
import { useData } from '@/state/useData';

export default function Search() {
  const [q, setQ] = useState('');
  const { data, loading } = useData(async (r) => ({ posts: await r.listPosts(), resources: await r.listResources() }));
  const term = q.trim().toLowerCase();
  const res = useMemo(() => {
    if (!data || term.length < 2) return null;
    const has = (s: string) => s.toLowerCase().includes(term);
    return {
      posts: data.posts.filter((p) => has(p.title) || has(p.body) || has(p.category)),
      resources: data.resources.filter((r) => has(r.title) || has(r.subtitle) || has(r.body)),
    };
  }, [data, term]);

  return (
    <Screen>
      <Header title="Search" back />
      <Field label="Search posts and resources" value={q} onChangeText={setQ} placeholder="e.g. stress, transfer, VPN" autoFocus returnKeyType="search" />
      {loading ? <Loading /> : !res ? <Text variant="small">Type at least two letters. Search looks at community posts and resources.</Text> :
        res.posts.length + res.resources.length === 0 ? <EmptyState capy="glasses" title="No matches" text="Try a different word." /> : (
          <>
            {res.resources.length ? <Text variant="h2" style={{ marginBottom: space.sm }}>Resources</Text> : null}
            {res.resources.map((r) => (
              <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={r.subtitle}
                onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })}
                right={!r.verified ? <Badge label="Unverified" tone="warn" /> : undefined} />
            ))}
            {res.posts.length ? <Text variant="h2" style={{ marginVertical: space.sm }}>Posts</Text> : null}
            {res.posts.map((p) => <PostCard key={p.id} post={p} compact />)}
          </>
        )}
    </Screen>
  );
}
