import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OptionSheet } from '@/components/Select';
import { Text } from '@/components/ui';
import { accents, colors } from '@/constants/brand';
import { DOWNVOTE_REASONS, type AuthorMeta, type DownvoteReason, type Vote, type VoteValue } from '@/data/types';
import { authorLine } from '@/lib/profileOptions';
import { verifiedLabel } from '@/data/auth';

/** "Engineer · 3–5 yrs at ABB" with a verified tick: role context without a name. */
export function AuthorTag({ author, mine }: { author: AuthorMeta | null; mine?: boolean }) {
  const line = authorLine(author);
  if (!line && !mine) return null;
  return (
    <View style={styles.author} accessible
      accessibilityLabel={`${mine ? 'You. ' : ''}${line ?? ''}${author?.verified ? `. ${verifiedLabel()}` : ''}`}>
      {author?.verified ? <Ionicons name="checkmark-circle" size={14} color={accents.blue.fg} /> : null}
      <Text variant="small" style={{ color: colors.navy2, fontWeight: '600' }}>
        {mine ? (line ? `You · ${line}` : 'You') : line}
      </Text>
    </View>
  );
}

/**
 * Up and down voting on every post and answer. A downvote asks for a reason first. Own content can't be voted on.
 * Own content can't be voted on.
 */
export function VoteControl({ score, vote, allowDown = true, disabled, onVote, horizontal = true }: {
  score: number; vote: Vote | null; allowDown?: boolean; disabled?: boolean; horizontal?: boolean;
  onVote: (value: VoteValue | null, reason?: DownvoteReason) => void;
}) {
  const [asking, setAsking] = useState(false);
  const up = vote?.value === 1;
  const down = vote?.value === -1;
  return (
    <View style={[styles.vote, !horizontal && { flexDirection: 'column' }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={up ? 'Remove upvote' : 'Upvote'} accessibilityState={{ selected: up, disabled }}
        disabled={disabled} onPress={() => onVote(up ? null : 1)} hitSlop={6} style={styles.voteBtn}>
        <Ionicons name={up ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={24} color={disabled ? colors.border : up ? colors.red : colors.muted} />
      </Pressable>
      <Text variant="h3" style={{ minWidth: 24, textAlign: 'center', color: up ? colors.red : down ? accents.blue.fg : colors.navy }}
        accessibilityLabel={`Score ${score}`}>{score}</Text>
      {allowDown ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={down ? `Remove downvote (${vote?.reason})` : 'Downvote, with a reason'}
            accessibilityState={{ selected: down, disabled }} disabled={disabled}
            onPress={() => (down ? onVote(null) : setAsking(true))} hitSlop={6} style={styles.voteBtn}>
            <Ionicons name={down ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={24} color={disabled ? colors.border : down ? accents.blue.fg : colors.muted} />
          </Pressable>
          <OptionSheet visible={asking} title="Why downvote this?" subtitle="A reason helps the writer improve it, and keeps downvotes fair."
            options={DOWNVOTE_REASONS.map((r) => ({ id: r, label: r }))} onSelect={(r) => onVote(-1, r as DownvoteReason)} onClose={() => setAsking(false)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  author: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  vote: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  voteBtn: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
