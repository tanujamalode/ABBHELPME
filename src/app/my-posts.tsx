import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, Header, Loading, Notice, Screen } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { useData } from '@/state/useData';

export default function MyPosts() {
  const { data, loading, error, reload } = useData(async (r) => (await r.listPosts()).filter((p) => p.mine));
  return (
    <Screen>
      <Header title="My Posts" back />
      <Notice text="Posts you wrote. Colleagues see them without your name or email." icon="eye-off-outline" />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState capy="laptop" title="You haven't posted anything yet" text="Your questions, achievements and personal posts appear here."
          action={<Button label="Write a personal post" onPress={() => router.push({ pathname: '/compose', params: { type: 'personal' } })} />} />
      ) : data.map((p) => <PostCard key={p.id} post={p} />)}
    </Screen>
  );
}
