import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, Header, Loading, Notice, Screen } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { useData } from '@/state/useData';

export default function MyPosts() {
  const { data, loading, error, reload } = useData(async (r) => (await r.listPosts()).filter((p) => !p.sample));
  return (
    <Screen>
      <Header title="My Posts" back />
      <Notice text="Everything here is On this device only. Nothing is shared with other employees, HR, IT or a counselor." icon="lock-closed-outline" />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState capy="laptop" title="You haven't written anything yet" text="Entries you save appear here, and stay on this device."
          action={<Button label="Write a personal note" onPress={() => router.push({ pathname: '/compose', params: { type: 'personal' } })} />} />
      ) : data.map((p) => <PostCard key={p.id} post={p} />)}
    </Screen>
  );
}
