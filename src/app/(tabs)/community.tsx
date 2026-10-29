import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chip, EmptyState, ErrorState, Header, IconButton, Loading, Notice, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { colors, space } from '@/constants/brand';
import { FILTERS, matchesFilter, type FeedFilter } from '@/lib/categories';
import { forYou } from '@/lib/personalize';
import { useData } from '@/state/useData';

const PAGE = 5;

export default function Community() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = FILTERS.some((f) => f.id === params.filter) ? (params.filter as FeedFilter) : undefined;
  const [filter, setFilter] = useState<FeedFilter>(paramFilter ?? 'foryou');
  const [prevParam, setPrevParam] = useState(paramFilter);
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  if (paramFilter !== prevParam) {
    setPrevParam(paramFilter);
    if (paramFilter) { setFilter(paramFilter); setShown(PAGE); }
  }
  const { data, loading, error, reload } = useData(async (repo) => {
    const posts = await repo.listPosts();
    const meta = await repo.getPostMeta(posts.map((p) => p.id));
    // "Most helpful": score with a gentle age decay so new posts still surface; no engagement-bait signals.
    const now = Date.now();
    const rank: Record<string, number> = {};
    for (const p of posts) rank[p.id] = (meta[p.id]?.score ?? 0) / Math.pow((now - p.createdAt) / 3_600_000 + 2, 0.8);
    const topics = await repo.getSelectedTopicIds();
    return { posts, rank, meta, topics };
  });

  const list = useMemo(() => {
    const base = filter === 'foryou' ? forYou(data?.posts ?? [], data?.topics ?? []) : data?.posts ?? [];
    const items = base.filter((p) => matchesFilter(p, filter));
    if (sort === 'new') return items;
    return [...items].sort((a, b) => (data?.rank[b.id] ?? 0) - (data?.rank[a.id] ?? 0));
  }, [data, filter, sort]);

  const compose = () => {
    const type = filter === 'achievements' ? 'achievement' : filter === 'personal' ? 'personal' : filter === 'polls' ? 'poll'
      : filter === 'discussions' ? 'discussion' : filter === 'work' || filter === 'hrit' ? 'work_question' : undefined;
    if (type) { router.push({ pathname: '/compose', params: { type } }); return; }
    Alert.alert('New post', 'What would you like to write?', [
      { text: 'Question', onPress: () => router.push({ pathname: '/compose', params: { type: 'work_question' } }) },
      { text: 'Discussion or idea', onPress: () => router.push({ pathname: '/compose', params: { type: 'discussion' } }) },
      { text: 'Poll', onPress: () => router.push({ pathname: '/compose', params: { type: 'poll' } }) },
      { text: 'Achievement', onPress: () => router.push({ pathname: '/compose', params: { type: 'achievement' } }) },
      { text: 'Personal support', onPress: () => router.push({ pathname: '/compose', params: { type: 'personal' } }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Screen>
      <Header title="Community" right={
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="people-outline" label="Communities" onPress={() => router.push('/communities')} />
          <IconButton icon="add-circle" label="New post" onPress={compose} />
        </View>} />
      <Notice text="Posts are shared with colleagues who sign in with a verified email, without your name or email. Personal posts are anonymous unless you choose to show your role." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
        {FILTERS.map((f) => <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => { setFilter(f.id); setShown(PAGE); }} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: space.lg, marginBottom: space.md }} accessibilityRole="tablist">
        {(['top', 'new'] as const).map((s) => (
          <Text key={s} variant="h3" accessibilityRole="tab" accessibilityState={{ selected: sort === s }} onPress={() => setSort(s)}
            style={{ color: sort === s ? colors.red : colors.muted, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: sort === s ? colors.red : 'transparent' }}>
            {s === 'top' ? 'Most helpful' : 'Newest'}
          </Text>
        ))}
      </View>
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : list.length === 0 ? (
        <EmptyState capy="headphones" title="Nothing here yet"
          text={filter === 'foryou' ? 'Nothing in your categories yet. Try All, or change your categories in your profile.' : 'Be the first to post in this section.'}
          action={<Button label="New post" onPress={compose} />} />
      ) : (
        <View>
          {list.slice(0, shown).map((p) => <PostCard key={p.id} post={p} meta={data?.meta[p.id]} />)}
          {shown < list.length ? <Button label="Load more" variant="secondary" onPress={() => setShown((s) => s + PAGE)} /> : null}
        </View>
      )}
    </Screen>
  );
}
