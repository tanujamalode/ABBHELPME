import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { accents, colors, radius, space } from '@/constants/brand';
import { attempt } from '@/lib/attempt';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

/** Attached photos. The files are private, so each one is opened with a short-lived signed URL. */
export function PostImages({ paths }: { paths: string[] }) {
  const { data } = useData((r) => r.getImageUrls(paths), [paths.join('|')]);
  if (!paths.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginBottom: space.md }}>
      {paths.map((p) => data?.[p]
        ? <Image key={p} source={{ uri: data[p] }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo attached to this post" />
        : <View key={p} style={[styles.photo, { backgroundColor: colors.sand }]} />)}
    </ScrollView>
  );
}

/**
 * A poll. Totals stay hidden until you have voted (or wrote the poll), so the running count can't sway votes.
 * You can change your vote at any time.
 */
export function PollView({ postId }: { postId: string }) {
  const { repo, bump } = useApp();
  const { data } = useData((r) => r.getPoll(postId), [postId]);
  if (!data || !data.options.length) return null;
  const { options, revealed, total } = data;
  const vote = (optionId: string) => { void attempt(async () => { await repo.votePoll(postId, optionId); bump(); }, 'save your vote'); };

  return (
    <View style={{ marginBottom: space.md }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const pct = revealed && total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: o.mine }}
            accessibilityLabel={revealed ? `${o.label}, ${o.votes} votes, ${pct} percent${o.mine ? ', your vote' : ''}` : o.label}
            onPress={() => vote(o.id)} style={[styles.option, o.mine && styles.optionMine]}>
            {revealed ? <View style={[styles.bar, { width: `${pct}%` }, o.mine && { backgroundColor: accents.rose.bg }]} /> : null}
            <Ionicons name={o.mine ? 'radio-button-on' : 'radio-button-off'} size={20} color={o.mine ? colors.red : colors.muted} />
            <Text variant="body" style={{ flex: 1, marginLeft: space.sm, color: colors.navy }}>{o.label}</Text>
            {revealed ? <Text variant="h3" style={{ fontSize: 14 }}>{pct}%</Text> : null}
          </Pressable>
        );
      })}
      <Text variant="small">
        {revealed ? `${total} ${total === 1 ? 'vote' : 'votes'} · tap another option to change yours` : 'Vote to see the results.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: 220, height: 160, borderRadius: radius.lg },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.lg, borderWidth: 1.5,
    borderColor: colors.border, backgroundColor: colors.surface, marginBottom: space.sm, overflow: 'hidden' },
  optionMine: { borderColor: colors.red },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.sand },
});
