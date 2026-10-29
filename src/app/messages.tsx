import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, Header, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { colors, space } from '@/constants/brand';
import type { Conversation } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { experienceLabel, roleLabel } from '@/lib/profileOptions';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const who = (c: Conversation) => c.otherName ?? c.otherAlias;
const sub = (c: Conversation) => [roleLabel(c.otherRole), experienceLabel(c.otherExperience)].filter(Boolean).join(' · ');

/** Message requests waiting for you, then your conversations. */
export default function Messages() {
  const { repo, bump } = useApp();
  const { data, loading, error, reload } = useData((r) => r.listConversations());
  const [showRole, setShowRole] = useState(false);
  const requests = (data ?? []).filter((c) => c.status === 'pending' && !c.iRequested);
  const sent = (data ?? []).filter((c) => c.status === 'pending' && c.iRequested);
  const chats = (data ?? []).filter((c) => c.status === 'active' || c.status === 'closed');

  const respond = (c: Conversation, accept: boolean) => {
    void attempt(async () => {
      await repo.respondChat(c.id, accept, showRole);
      bump();
      if (accept) router.push({ pathname: '/chat/[id]', params: { id: c.id } });
    }, accept ? 'accept that request' : 'decline that request');
  };

  return (
    <Screen>
      <Header title="Messages" back right={<Button label="Find people" variant="ghost" icon="people-outline" onPress={() => router.push('/people')} />} />
      {loading ? <Loading /> : error ? <ErrorState text={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState capy="hi" title="No conversations yet" text="Find a colleague who understands, or wait for someone to say hello."
          action={<Button label="People who understand" onPress={() => router.push('/people')} />} />
      ) : (
        <>
          {requests.length ? (
            <>
              <Text variant="h2" accessibilityRole="header" style={{ marginBottom: space.sm }}>Requests ({requests.length})</Text>
              {requests.map((c) => (
                <Card key={c.id} style={{ marginBottom: space.sm }}>
                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <IconTile icon="mail-unread-outline" accent="amber" size={42} />
                    <View style={{ flex: 1 }}>
                      <Text variant="h3">{who(c)} would like to chat</Text>
                      {sub(c) ? <Text variant="small">{sub(c)}</Text> : null}
                      <Text variant="body" style={{ marginTop: 4 }} numberOfLines={4}>{c.lastBody}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
                    <View style={{ flex: 1, paddingRight: space.md }}>
                      <Text variant="h3" style={{ fontSize: 14 }}>Show my role & experience</Text>
                      <Text variant="small">Off: you stay anonymous.</Text>
                    </View>
                    <Switch value={showRole} onValueChange={setShowRole} accessibilityLabel="Show my role and experience when I accept"
                      trackColor={{ true: colors.red, false: colors.border }} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                    <View style={{ flex: 1 }}><Button label="Decline" variant="secondary" onPress={() => respond(c, false)} /></View>
                    <View style={{ flex: 1 }}><Button label="Accept" onPress={() => respond(c, true)} /></View>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {chats.length ? <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.md, marginBottom: space.sm }}>Conversations</Text> : null}
          {chats.map((c) => (
            <Card key={c.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })}
              accessibilityLabel={`${who(c)}${c.unread ? `, ${c.unread} unread` : ''}`} style={{ marginBottom: space.sm }}>
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <IconTile icon="chatbubble-ellipses-outline" accent={c.status === 'closed' ? 'slate' : 'blue'} size={42} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="h3" style={{ flexShrink: 1 }} numberOfLines={1}>{who(c)}</Text>
                    {c.status === 'closed' ? <Badge label="Closed" tone="neutral" /> : null}
                    {c.muted ? <Badge label="Muted" tone="neutral" /> : null}
                  </View>
                  <Text variant="small" numberOfLines={1}>{c.lastBody ?? 'No messages yet'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {c.lastAt ? <Text variant="small">{timeAgo(c.lastAt)}</Text> : null}
                  {c.unread ? <Badge label={String(c.unread)} tone="ok" /> : null}
                </View>
              </View>
            </Card>
          ))}

          {sent.length ? (
            <>
              <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.md, marginBottom: space.sm }}>Waiting for a reply</Text>
              {sent.map((c) => (
                <Card key={c.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} style={{ marginBottom: space.sm }}
                  accessibilityLabel={`Request to ${who(c)}, waiting`}>
                  <Text variant="h3">{who(c)}</Text>
                  <Text variant="small" numberOfLines={1}>{c.lastBody}</Text>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
      <Notice text="Conversations are private between the two of you. Nothing is sent to HR, IT or managers. Use report or block if something doesn't feel right." icon="lock-closed-outline" />
    </Screen>
  );
}
