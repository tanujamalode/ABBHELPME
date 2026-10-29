import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Chip, EmptyState, ErrorState, Field, Header, Loading, Notice, Row, Screen } from '@/components/ui';
import { GROUP_META, RESOURCE_FILTERS, resourceMatches, resourceSearch, reviewedLabel, type ResourceFilter } from '@/lib/resourceMeta';
import { space } from '@/constants/brand';
import { useData } from '@/state/useData';

export default function Resources() {
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useData((r) => r.listResources());
  const list = resourceSearch((data ?? []).filter((r) => resourceMatches(r.group, filter)), query);
  return (
    <Screen>
      <Header title="Resources" subtitle="Useful information, support and contacts — all in one place." />
      <Notice text="Resources marked Unverified have not yet been reviewed by ABB. Check with HR or IT before relying on them." tone="warn" icon="alert-circle-outline" />
      <Field label="Search resources" value={query} onChangeText={setQuery} placeholder="e.g. leave, VPN, stress" returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}>
        {RESOURCE_FILTERS.map((f) => <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />)}
      </ScrollView>
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : list.length === 0 ? (
        <EmptyState capy="thinking" title={query ? 'No matches' : 'No resources in this group'} text={query ? 'Try a different word.' : undefined} />
      ) : list.map((r) => (
        <Row key={r.id} icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} title={r.title} subtitle={`${r.subtitle}${r.subtitle ? ' · ' : ''}${reviewedLabel(r.reviewedAt)}`}
          onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })}
          right={<View style={{ alignItems: 'flex-end', gap: 4 }}>
            {!r.verified ? <Badge label="Unverified" tone="warn" /> : <Badge label="ABB verified" tone="ok" />}
            {r.source === 'External' ? <Badge label="External" tone="neutral" /> : null}
          </View>} />
      ))}
    </Screen>
  );
}
