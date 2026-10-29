import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Chip, EmptyState, ErrorState, Header, IconButton, Loading, Notice, Screen, Text } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { colors, space } from '@/constants/brand';
import { FILTERS, matchesFilter, type FeedFilter } from '@/lib/categories';
import { useData } from '@/state/useData';

const PAGE = 5;

export default function Community() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = FILTERS.some((f) => f.id === params.filter) ? (params.filter as FeedFilter) : undefined;
  const [filter, setFilter] = useState<FeedFilter>(paramFilter ?? 'all');
  const [prevParam, setPrevParam] = useState(paramFilter);
  const [shown, setShown] = useState(PAGE);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  if (paramFilter !== prevParam) {
    setPrevParam(paramFilter);
    if (paramFilter) { setFilter(paramFilter); setShown(PAGE); }
  }
  const { data, loading, error, reload } = useData(async (repo) => {
    const posts = await repo.listPosts();
    const scores = await repo.getScores('post', posts.map((p) => p.id));
    // "Most helpful": score with a gentle age decay so new posts still surface; no engagement-bait signals.
    const now = Date.now();
    const rank: Record<string, number> = {};
    for (const p of posts) rank[p.id] = (scores[p.id] ?? 0) / Math.pow((now - p.createdAt) / 3_600_000 + 2, 0.8);
    return { posts, rank };
  });

  const list = useMemo(() => {
    const items = (data?.posts ?? []).filter((p) => matchesFilter(p, filter));
    if (sort === 'new') return items;
    return [...items].sort((a, b) => (data?.rank[b.id] ?? 0) - (data?.rank[a.id] ?? 0));
  }, [data, filter, sort]);

  const compose = () => {
    const type = filter === 'achievements' ? 'achievement' : filter === 'personal' ? 'personal' : filter === 'all' ? undefined : 'work_question';
    if (type) { router.push({ pathname: '/compose', params: { type } }); return; }
    Alert.alert('Add to this device', 'What would you like to write?', [
      { text: 'Work question', onPress: () => router.push({ pathname: '/compose', params: { type: 'work_question' } }) },
      { text: 'Achievement', onPress: () => router.push({ pathname: '/compose', params: { type: 'achievement' } }) },
      { text: 'Personal note', onPress: () => router.push({ pathname: '/compose', params: { type: 'personal' } }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Screen>
      <Header title="Community" right={<IconButton icon="add-circle" label="Add an entry" onPress={compose} />} />
      <Notice text="Example posts are marked Sample content. Anything you add is On this device only — it isn't shared with other employees or visible to ABB." />
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
        <EmptyState capy="headphones" title="Nothing here yet" text="Add your own entry — it stays on this device."
          action={<Button label="Add an entry" onPress={compose} />} />
      ) : (
        <View>
          {list.slice(0, shown).map((p) => <PostCard key={p.id} post={p} />)}
          {shown < list.length ? <Button label="Load more" variant="secondary" onPress={() => setShown((s) => s + PAGE)} /> : null}
        </View>
      )}
    </Screen>
  );
}
