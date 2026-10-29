import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Capy, CapyAvatar } from '@/components/Capy';
import { Badge, Button, IconTile, Text } from '@/components/ui';
import { accents, colors, radius, shadow, space } from '@/constants/brand';
import type { Resource } from '@/data/types';
import { STARTER_PROMPTS, localAssistant, type AssistantReply } from '@/lib/assistant';
import { newId } from '@/lib/id';
import { GROUP_META } from '@/lib/resourceMeta';
import { useData } from '@/state/useData';

type Msg = { id: string; from: 'me' | 'bot' } & Partial<AssistantReply> & { text: string };

const WELCOME: Msg = {
  id: 'welcome', from: 'bot',
  text: "Hi, I'm Cappy! Ask me about well-being, HR, IT or the workplace and I'll point you to the right resource.",
};

export default function Assistant() {
  const { data: resources } = useData((r) => r.listResources());
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const list = useRef<FlatList<Msg>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setInput('');
    setMsgs((m) => [...m, { id: newId(), from: 'me', text }]);
    setTyping(true);
    const reply = await localAssistant.reply(text, resources ?? []);
    // A short pause so the reply reads as a response rather than a flash.
    timer.current = setTimeout(() => {
      setMsgs((m) => [...m, { id: newId(), from: 'bot', ...reply }]);
      setTyping(false);
    }, 450);
  };

  const byId = new Map((resources ?? []).map((r) => [r.id, r]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close assistant" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="chevron-down" size={22} color={colors.navy} />
        </Pressable>
        <CapyAvatar size={42} pose="headphones" />
        <View style={{ flex: 1 }}>
          <Text variant="h3" accessibilityRole="header">Cappy</Text>
          <Text variant="small">Your guide · runs on your phone</Text>
        </View>
        <Badge label="Guide" tone="neutral" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          showsVerticalScrollIndicator={false}
          ref={list}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <>
            <View style={{ alignItems: 'center', marginBottom: space.md }}>
              <Capy pose="hi" size={120} label="Cappy waving hello" />
            </View>
            <View style={styles.privacy}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
              <Text variant="small" style={{ flex: 1 }}>
                Chats aren&apos;t saved or sent anywhere. Cappy isn&apos;t a person or AI, isn&apos;t monitored and can&apos;t contact anyone.
              </Text>
            </View>
            </>
          }
          renderItem={({ item }) => <Bubble msg={item} byId={byId} />}
          ListFooterComponent={
            <>
              {typing ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
                  <Capy pose="thinking" size={56} />
                  <View style={[styles.bubble, styles.bot]}><Text variant="small">Cappy is thinking…</Text></View>
                </View>
              ) : null}
              {msgs.length === 1 ? (
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  <Text variant="label" style={{ letterSpacing: 0.8 }}>TRY ASKING</Text>
                  {STARTER_PROMPTS.map((p) => (
                    <Pressable key={p} accessibilityRole="button" accessibilityLabel={p} onPress={() => send(p)}
                      style={({ pressed }) => [styles.starter, pressed && { opacity: 0.8 }]}>
                      <Text variant="body" style={{ flex: 1, color: colors.navy }}>{p}</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.red} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          }
        />

        <View style={styles.composer}>
          <TextInput
            value={input} onChangeText={setInput} placeholder="Ask a question…" placeholderTextColor={colors.muted}
            accessibilityLabel="Message Cappy" style={styles.input} multiline maxLength={500}
            onSubmitEditing={() => send(input)} blurOnSubmit returnKeyType="send"
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !input.trim() || typing }}
            disabled={!input.trim() || typing} onPress={() => send(input)}
            style={[styles.sendBtn, (!input.trim() || typing) && { opacity: 0.4 }]}>
            <Ionicons name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, byId }: { msg: Msg; byId: Map<string, Resource> }) {
  const mine = msg.from === 'me';
  const cards = (msg.resourceIds ?? []).map((id) => byId.get(id)).filter((r): r is Resource => !!r);
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: space.sm, paddingLeft: mine ? 0 : 40 }}>
      {!mine ? (
        <View style={{ position: 'absolute', left: 0, top: 0 }}>
          <CapyAvatar size={32} pose={msg.urgent ? 'support' : 'happy'} ring={msg.urgent ? colors.red : colors.border} />
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.me : styles.bot, msg.urgent && styles.urgent]}
        accessibilityLabel={`${mine ? 'You' : 'Assistant'}: ${msg.text}`} accessible>
        {msg.urgent ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="alert-circle" size={16} color={colors.redDark} />
            <Text variant="h3" style={{ color: colors.redDark }}>Urgent help</Text>
          </View>
        ) : null}
        <Text variant="body" style={{ color: mine ? '#fff' : colors.navy }}>{msg.text}</Text>
      </View>
      {(msg.actions ?? []).map((a) => (
        <View key={`${a.href}:${a.label}`} style={{ alignSelf: 'stretch' }}>
          <Button label={a.label} variant="secondary" onPress={() => router.push(a.href as never)} />
        </View>
      ))}
      {cards.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Open ${r.title}`}
          onPress={() => router.push({ pathname: '/resource/[id]', params: { id: r.id } })}
          style={({ pressed }) => [styles.resCard, pressed && { opacity: 0.85 }]}>
          <IconTile icon={GROUP_META[r.group].icon} accent={GROUP_META[r.group].accent} size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>{r.title}</Text>
            <Text variant="small" numberOfLines={1}>{r.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}
      {msg.suggestCompose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Write this as a question in Community"
          onPress={() => router.push({ pathname: '/compose', params: { type: 'work_question' } })}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
          <Ionicons name="create-outline" size={16} color={colors.red} />
          <Text variant="h3" style={{ color: colors.red, fontSize: 14 }}>Write it as a question</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  privacy: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', padding: space.md, borderRadius: radius.lg,
    backgroundColor: accents.slate.bg, marginBottom: space.sm },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  me: { backgroundColor: colors.red, borderBottomRightRadius: 6 },
  bot: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  urgent: { backgroundColor: colors.redTint, borderColor: '#F5B8C2' },
  resCard: { width: '85%', flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: space.xs },
  starter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, paddingHorizontal: space.lg, paddingTop: 13, paddingBottom: 13,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, fontSize: 16, color: colors.navy },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red, ...shadow },
});
