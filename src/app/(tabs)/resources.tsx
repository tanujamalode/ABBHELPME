import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Chip, EmptyState, ErrorState, Header, Loading, Notice, Row, Screen } from '@/components/ui';
import { GROUP_META, RESOURCE_FILTERS, resourceMatches, type ResourceFilter } from '@/lib/resourceMeta';
import { space } from '@/constants/brand';
import { useData } from '@/state/useData';

export default function Resources() {
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const { data, loading, error, reload } = useData((r) => r.listResources());
  const list = (data ?? []).filter((r) => resourceMatches(r.group, filter));
  return (
    <Screen>
      <Header title="Resources" subtitle="Useful information, support and contacts — all in one place." />
      <Notice text="Resources are bundled sample entries and are marked Unverified until ABB supplies approved content and contacts." tone="warn" icon="alert-circle-outline" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
        {RESOURCE_FILTERS.map((f) => <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />)}
      </ScrollView>
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : list.length === 0 ? (
        <EmptyState capy="thinking" title="No resources in this group" />
      ) : list.map((r) => (
        <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={r.subtitle}
          onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })}
          right={<View style={{ alignItems: 'flex-end' }}>{!r.verified ? <Badge label="Unverified" tone="warn" /> : <Badge label="Verified" tone="ok" />}</View>} />
      ))}
    </Screen>
  );
}
