import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OptionSheet } from '@/components/Select';
import { Badge, Button, EmptyState, ErrorState, Header, IconButton, Loading, Notice, Text } from '@/components/ui';
import { colors, radius, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { isUrgentText } from '@/lib/assistant';
import { confirmContent } from '@/lib/confirmContent';
import { experienceLabel, roleLabel } from '@/lib/profileOptions';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

const POLL_MS = 4000;
type MenuAction = 'mute' | 'unmute' | 'reveal' | 'save' | 'unsave' | 'report' | 'block' | 'leave';

/** One conversation. New messages arrive by checking every few seconds while the screen is open. */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, bump } = useApp();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const scroller = useRef<ScrollViewInstance>(null);

  const { data, loading, error, reload } = useData(async (r) => {
    const [convs, messages, saved] = await Promise.all([r.listConversations(), r.listMessages(String(id)), r.isBookmarked('conversation', String(id))]);
    return { conv: convs.find((c) => c.id === id) ?? null, messages, saved };
  }, [id]);

  // Keep the thread fresh while this screen is showing.
  useFocusEffect(useCallback(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]));

  const unread = data?.conv?.unread ?? 0;
  useEffect(() => {
    if (unread > 0) repo.markChatRead(String(id)).then(bump).catch(() => { /* retried on the next refresh */ });
  }, [unread, id, repo, bump]);

  const count = data?.messages.length ?? 0;
  useEffect(() => { scroller.current?.scrollToEnd({ animated: true }); }, [count]);

  if (loading) return <SafeAreaView style={styles.fill}><View style={{ padding: space.lg }}><Header title="Conversation" back /><Loading /></View></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.fill}><View style={{ padding: space.lg }}><Header title="Conversation" back /><ErrorState text={error} onRetry={reload} /></View></SafeAreaView>;
  if (!data?.conv) {
    return (
      <SafeAreaView style={styles.fill}><View style={{ padding: space.lg }}>
        <Header title="Conversation" back />
        <EmptyState capy="surprised" title="This conversation is no longer available" action={<Button label="Back to messages" onPress={() => router.replace('/messages')} />} />
      </View></SafeAreaView>
    );
  }

  const { conv, messages, saved } = data;
  const name = conv.otherName ?? conv.otherAlias;
  const detail = [roleLabel(conv.otherRole), experienceLabel(conv.otherExperience)].filter(Boolean).join(' · ');
  const open = conv.status === 'active';
  const incoming = conv.status === 'pending' && !conv.iRequested;

  const doSend = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const ok = await attempt(async () => { await repo.sendMessage(conv.id, body); return true; }, 'send that');
    if (ok) { setText(''); reload(); }
    setBusy(false);
  };

  const send = () => {
    const body = text.trim();
    if (!body || busy) return;
    confirmContent(body, () => {
      if (isUrgentText(body)) {
        Alert.alert('Support is available', 'It sounds like things may be very hard right now. If you or someone else is in danger, contact your local emergency services. You can also see support options.', [
          { text: 'See support options', onPress: () => router.push({ pathname: '/resource/[id]', params: { id: 'r-eap' } }) },
          { text: 'Send my message', onPress: () => { void doSend(); } },
        ]);
      } else void doSend();
    });
  };

  const confirm = (title: string, message: string, label: string, run: () => Promise<unknown>, leave = false) =>
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, {
      text: label, style: 'destructive', onPress: async () => {
        const done = await attempt(async () => { await run(); return true; }, 'do that');
        if (done) { bump(); if (leave) router.replace('/messages'); else reload(); }
      },
    }]);

  const actions: { id: MenuAction; label: string }[] = [
    { id: conv.muted ? 'unmute' : 'mute', label: conv.muted ? 'Unmute notifications' : 'Mute this conversation' },
    ...(open && !conv.iRevealed ? [{ id: 'reveal' as const, label: 'Reveal my name and role' }] : []),
    { id: saved ? 'unsave' : 'save', label: saved ? 'Remove from saved' : 'Save this conversation' },
    { id: 'report', label: 'Report this person' },
    { id: 'block', label: 'Block this person' },
    { id: 'leave', label: 'Leave conversation' },
  ];

  const onAction = (a: string) => {
    switch (a as MenuAction) {
      case 'mute': case 'unmute':
        void attempt(async () => { await repo.setChatFlag(conv.id, 'muted', a === 'mute'); bump(); reload(); }); break;
      case 'save': case 'unsave':
        void attempt(async () => { await repo.toggleBookmark('conversation', conv.id); reload(); }); break;
      case 'reveal':
        confirm('Reveal who you are?', 'They will see your display name, role and experience. You cannot undo this in this conversation.', 'Reveal', () => repo.setChatFlag(conv.id, 'reveal', true)); break;
      case 'report':
        confirm('Report this person?', 'A short note is sent to the moderators. If several people report the same person they are hidden from discovery until it is reviewed.', 'Report', () => repo.reportChat(conv.id, 'user_report')); break;
      case 'block':
        confirm('Block this person?', 'They can no longer message you or find you, and this conversation closes. They are not told.', 'Block', () => repo.blockChat(conv.id), true); break;
      case 'leave':
        confirm('Leave this conversation?', 'It closes and disappears from your messages. The other person is told you left.', 'Leave', () => repo.leaveChat(conv.id), true); break;
    }
  };

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
          <Header title={name} back subtitle={detail || (conv.otherRevealed ? undefined : 'Anonymous · made-up name')}
            right={<IconButton icon="ellipsis-horizontal" label="Conversation options" onPress={() => setMenu(true)} />} />
        </View>
        <View style={styles.safety}>
          <Ionicons name="heart-circle-outline" size={18} color={colors.navy2} />
          <Text variant="small" style={{ flex: 1, color: colors.navy2 }}>
            Peer support, not professional help.{' '}
            <Text variant="small" style={{ color: colors.red, fontWeight: '700' }} accessibilityRole="link"
              onPress={() => router.push({ pathname: '/resource/[id]', params: { id: 'r-eap' } })}>See professional support</Text>
          </Text>
        </View>

        <ScrollView ref={scroller} style={styles.fill} contentContainerStyle={{ padding: space.lg, gap: space.sm }} keyboardShouldPersistTaps="handled">
          {messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
              <Text variant="body" style={{ color: m.mine ? '#fff' : colors.navy }}>{m.body}</Text>
              <Text variant="small" style={{ color: m.mine ? '#ffffffcc' : colors.muted, fontSize: 11, marginTop: 2 }}>{timeAgo(m.createdAt)}</Text>
            </View>
          ))}
          {conv.status === 'closed' ? <Notice text="This conversation is closed. No new messages can be sent." icon="lock-closed-outline" /> : null}
          {conv.status === 'declined' ? <Notice text="This request was not accepted." icon="information-circle-outline" /> : null}
          {conv.status === 'pending' && conv.iRequested ? <Notice text="Waiting for them to accept. You can chat once they do." icon="time-outline" /> : null}
        </ScrollView>

        {incoming ? (
          <View style={styles.composer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
              <Text variant="small" style={{ flex: 1 }}>Show my role & experience when I accept</Text>
              <Switch value={showRole} onValueChange={setShowRole} accessibilityLabel="Show my role and experience when I accept"
                trackColor={{ true: colors.red, false: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Decline" variant="secondary"
                  onPress={() => { void attempt(async () => { await repo.respondChat(conv.id, false); bump(); router.replace('/messages'); }); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Accept" onPress={() => { void attempt(async () => { await repo.respondChat(conv.id, true, showRole); bump(); reload(); }); }} />
              </View>
            </View>
          </View>
        ) : open ? (
          <View style={[styles.composer, { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }]}>
            <TextInput value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor={colors.muted}
              multiline maxLength={1000} accessibilityLabel="Message" style={styles.input} />
            <View style={{ width: 96 }}>
              <Button label="Send" onPress={send} loading={busy} disabled={!text.trim()} />
            </View>
          </View>
        ) : null}
        {conv.muted ? <View style={{ alignItems: 'center', paddingBottom: space.xs }}><Badge label="Muted" tone="neutral" /></View> : null}
      </KeyboardAvoidingView>

      <OptionSheet visible={menu} title="Conversation options" options={actions} onSelect={onAction} onClose={() => setMenu(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  safety: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.sand },
  bubble: { maxWidth: '82%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.red, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  composer: { padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 48, maxHeight: 120, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.bg, color: colors.navy, fontSize: 16 },
});
