import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, Header, IconButton, Loading, Notice, Screen, Text } from '@/components/ui';
import { accents, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { confirmLeaveApp } from '@/lib/leaveApp';
import { GROUP_META, reviewedLabel } from '@/lib/resourceMeta';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

export default function ResourceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, bump } = useApp();
  const { data, loading, error, reload } = useData(async (r) => {
    const res = await r.getResource(String(id));
    if (!res) return null;
    return { res, saved: await r.isBookmarked('resource', res.id) };
  }, [id]);

  if (loading) return <Screen><Loading /></Screen>;
  if (error) return <Screen><Header title="Resource" back /><ErrorState text={error} onRetry={reload} /></Screen>;
  if (!data) return <Screen><Header title="Resource" back /><EmptyState capy="surprised" title="Resource not found" action={<Button label="All resources" onPress={() => router.replace('/resources')} />} /></Screen>;

  const { res, saved } = data;
  const hasContact = !!(res.phone || res.url || res.email);
  return (
    <Screen>
      <Header title={res.title} back right={
        <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Remove from saved' : 'Save resource'} active={saved}
          onPress={() => { void attempt(async () => { await repo.toggleBookmark('resource', res.id); bump(); }); }} />} />
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Badge label={res.verified ? 'ABB verified' : 'Not yet verified'} tone={res.verified ? 'ok' : 'warn'} />
        {res.source === 'External' ? <Badge label="External resource" tone="neutral" /> : <Badge label="From ABB" tone="neutral" />}
      </View>
      <Text variant="small" style={{ marginBottom: space.md }}>{reviewedLabel(res.reviewedAt)}</Text>
      <Card tint={accents[GROUP_META[res.group].accent].bg}>
        <Text variant="h3">{res.subtitle}</Text>
        <Text variant="body" style={{ marginTop: space.sm }}>{res.body}</Text>
      </Card>

      {hasContact ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          {res.phone ? <Button label={`Call ${res.title}`} icon="call-outline" onPress={() => confirmLeaveApp('phone', res.phone!, res.title)} /> : null}
          {res.email ? <Button label="Send an email" icon="mail-outline" variant="secondary" onPress={() => confirmLeaveApp('email', res.email!, res.title)} /> : null}
          {res.url ? <Button label="Open link" icon="open-outline" variant="secondary" onPress={() => confirmLeaveApp('link', res.url!, res.title)} /> : null}
        </View>
      ) : (
        <Notice text="No contact details are set up for this resource yet, so there's nothing to call or open from here. Please ask HR or IT for the approved route." tone="warn" icon="alert-circle-outline" />
      )}
      {res.source === 'External' ? <Notice text="This resource is run by an outside organisation, not ABB. Links open outside the app." icon="open-outline" /> : null}
      <Notice text="Viewing a resource doesn't create a support ticket or notify anyone. This app is not monitored in real time. In an emergency, contact your local emergency services." />
    </Screen>
  );
}
