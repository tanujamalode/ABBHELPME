import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthorTag, VoteControl } from '@/components/community';
import { ModerationReview } from '@/components/ModerationReview';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Header, IconButton, IconTile, Loading, Notice, Screen, Text } from '@/components/ui';
import { confirmDeletePost, confirmReport } from '@/components/postActions';
import { KIND_STYLE } from '@/components/PostCard';
import { accents, colors, space } from '@/constants/brand';
import { SAMPLE_ANSWERS } from '@/data/seed';
import type { Comment } from '@/data/types';
import { KIND_LABEL } from '@/lib/categories';
import { checkContent, type ModerationResult } from '@/lib/moderation';
import { originBadge } from '@/lib/origin';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, bump } = useApp();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRole, setShowRole] = useState<boolean | null>(null);
  const [review, setReview] = useState<ModerationResult | null>(null);
  const { data, loading, error, reload } = useData(async (r) => {
    const post = await r.getPost(String(id));
    if (!post) return null;
    const [comments, postScores, vote, saved, votes] = await Promise.all([
      r.listComments(post.id), r.getScores('post', [post.id]), r.getVote('post', post.id), r.isBookmarked('post', post.id), r.listVotes(),
    ]);
    const commentScores = await r.getScores('comment', comments.map((c) => c.id));
    const myVotes = new Map(votes.filter((v) => v.target === 'comment').map((v) => [v.targetId, v]));
    return { post, comments, score: postScores[post.id] ?? 0, vote, saved, commentScores, myVotes };
  }, [id]);

  if (loading) return <Screen><Loading /></Screen>;
  if (error) return <Screen><Header title="Discussion" back /><ErrorState text={error} onRetry={reload} /></Screen>;
  if (!data) return <Screen><Header title="Discussion" back /><EmptyState capy="surprised" title="This entry is no longer on this device" action={<Button label="Back to Community" onPress={() => router.replace('/community')} />} /></Screen>;

  const { post, comments, score, vote, saved, commentScores, myVotes } = data;
  const isQuestion = post.kind === 'work_question';
  const mine = !post.sample;
  const answer = SAMPLE_ANSWERS[post.id];
  const ks = KIND_STYLE[post.kind];
  const roleOn = showRole ?? post.kind !== 'personal';
  const noun = isQuestion ? 'answer' : 'comment';

  // Accepted first, then by score, then oldest first.
  const sorted = [...comments].sort((a, b) =>
    Number(b.accepted) - Number(a.accepted) || (commentScores[b.id] ?? 0) - (commentScores[a.id] ?? 0) || a.createdAt - b.createdAt);

  const submit = async (force = false) => {
    if (comment.trim().length < 2) return;
    if (!force) {
      const res = checkContent(comment);
      if (res.issues.length) { setReview(res); return; }
    }
    setBusy(true);
    await repo.addComment(post.id, comment, roleOn);
    setComment(''); setReview(null); bump(); setBusy(false);
  };

  return (
    <Screen>
      <Header title={isQuestion ? 'Work Question' : KIND_LABEL[post.kind]} back
        right={<IconButton icon="flag-outline" label="Report this content" onPress={() => confirmReport(post, repo, bump)} />} />

      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconTile icon={ks.icon} accent={ks.accent} size={48} />
        <View style={{ flex: 1 }}>
          <Text variant="h2" accessibilityRole="header">{post.title || 'Personal note'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <Text variant="label">{post.category}</Text>
            <Text variant="small">· {timeAgo(post.createdAt)}</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: space.md }}>
        <AuthorTag author={post.author} mine={mine} />
        <Badge {...originBadge(post)} />
      </View>

      <Text variant="body" style={{ marginVertical: space.lg }}>{post.body}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <VoteControl score={score} vote={vote} disabled={mine} onVote={async (v, reason) => { await repo.setVote('post', post.id, v, reason ?? null); bump(); }} />
        <View style={{ flex: 1 }} />
        <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} label={saved ? 'Remove from saved' : 'Save'} active={saved}
          onPress={async () => { await repo.toggleBookmark('post', post.id); bump(); }} />
        {mine ? <IconButton icon="create-outline" label="Edit" onPress={() => router.push({ pathname: '/compose', params: { id: post.id } })} /> : null}
        {mine ? <IconButton icon="trash-outline" label="Delete" onPress={() => confirmDeletePost(post, repo, bump, true)} /> : null}
      </View>

      {answer ? (
        <View style={{ marginTop: space.xl }}>
          <Badge label="Official answer · sample" tone="ok" />
          <Card tint={accents.green.bg} style={{ marginTop: space.sm }}>
            <Text variant="h3">From HR / IT</Text>
            <Text variant="body" style={{ marginTop: space.xs }}>{answer.body}</Text>
          </Card>
          <Notice text="Demonstration content. In the shared version, HR and IT staff can mark answers Official. This one has not been written or reviewed by real ABB staff." tone="warn" />
        </View>
      ) : null}

      <Text variant="h2" accessibilityRole="header" style={{ marginTop: space.xl, marginBottom: space.md }}>
        {isQuestion ? 'Answers' : 'Comments'} ({comments.length})
      </Text>
      {comments.length === 0 ? <Text variant="small">No {noun}s yet. Anything you add is saved on this device only.</Text> : null}
      {sorted.map((c) => (
        <CommentCard key={c.id} c={c} score={commentScores[c.id] ?? 0} vote={myVotes.get(c.id) ?? null} isQuestion={isQuestion}
          canAccept={mine && isQuestion}
          onVote={async (v, reason) => { await repo.setVote('comment', c.id, v, reason ?? null); bump(); }}
          onAccept={async () => { await repo.acceptAnswer(post.id, c.accepted ? null : c.id); bump(); }} />
      ))}

      <View style={{ marginTop: space.md }}>
        {review ? (
          <ModerationReview result={review} busy={busy} onEdit={() => setReview(null)} onPostAnyway={() => submit(true)} />
        ) : null}
        <Field label={isQuestion ? 'Your answer' : 'Add a comment'} value={comment} onChangeText={(t) => { setComment(t); setReview(null); }}
          placeholder={isQuestion ? 'Share what worked for you…' : 'Write something supportive…'} maxLength={300} multiline />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <Text variant="h3" style={{ fontSize: 14 }}>Show my role & experience</Text>
            <Text variant="small">Your name is never shown.</Text>
          </View>
          <Switch value={roleOn} onValueChange={setShowRole} accessibilityLabel="Show my role and experience"
            trackColor={{ true: colors.red, false: colors.border }} />
        </View>
        <Button label={isQuestion ? 'Post answer' : 'Post comment'} onPress={() => submit()} disabled={comment.trim().length < 2 || !!review} loading={busy && !review} />
      </View>

      <View style={{ marginTop: space.xl }}>
        <Button label="Find related resources" icon="document-text-outline" variant="secondary" onPress={() => router.push('/resources')} />
        <Notice text="Finding a resource doesn't create a support ticket or contact anyone." />
      </View>
    </Screen>
  );
}

function CommentCard({ c, score, vote, isQuestion, canAccept, onVote, onAccept }: {
  c: Comment; score: number; vote: Parameters<typeof VoteControl>[0]['vote']; isQuestion: boolean; canAccept: boolean;
  onVote: Parameters<typeof VoteControl>[0]['onVote']; onAccept: () => void;
}) {
  const mine = !c.sample;
  return (
    <Card style={[{ marginBottom: space.sm }, c.accepted && { borderColor: accents.green.fg, borderWidth: 1.5 }]}>
      {c.accepted ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm }}>
          <Ionicons name="checkmark-circle" size={18} color={accents.green.fg} />
          <Text variant="h3" style={{ color: accents.green.fg, fontSize: 14 }}>Accepted answer</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <AuthorTag author={c.author} mine={mine} />
        <Text variant="small">{timeAgo(c.createdAt)}</Text>
        {c.sample && !c.shared ? <Badge label="Sample" tone="sample" /> : null}
      </View>
      <Text variant="body">{c.body}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}>
        <VoteControl score={score} vote={vote} disabled={mine} onVote={onVote} />
        <View style={{ flex: 1 }} />
        {canAccept ? (
          <Pressable accessibilityRole="button" accessibilityLabel={c.accepted ? 'Unmark accepted answer' : 'Mark as accepted answer'}
            onPress={onAccept} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: space.sm }}>
            <Ionicons name={c.accepted ? 'checkmark-circle' : 'checkmark-circle-outline'} size={20} color={accents.green.fg} />
            <Text variant="small" style={{ color: accents.green.fg, fontWeight: '700' }}>{c.accepted ? 'Accepted' : 'Accept'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
