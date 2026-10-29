import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthorTag, VoteControl } from '@/components/community';
import { Badge, Card, IconButton, IconTile, Text, type IconName } from '@/components/ui';
import { showPostMenu } from '@/components/postActions';
import { colors, space, type Accent } from '@/constants/brand';
import type { Post, PostKind } from '@/data/types';
import { originBadge } from '@/lib/origin';
import { timeAgo } from '@/lib/time';
import { useApp } from '@/state/AppProvider';
import { useData } from '@/state/useData';

export const KIND_STYLE: Record<PostKind, { icon: IconName; accent: Accent }> = {
  personal: { icon: 'heart-outline', accent: 'rose' },
  work_question: { icon: 'bulb-outline', accent: 'blue' },
  achievement: { icon: 'ribbon-outline', accent: 'amber' },
};

export function PostCard({ post, compact }: { post: Post; compact?: boolean }) {
  const { repo, bump } = useApp();
  const { data } = useData(async (r) => {
    const [scores, vote, saved, comments] = await Promise.all([
      r.getScores('post', [post.id]), r.getVote('post', post.id), r.isBookmarked('post', post.id), r.listComments(post.id),
    ]);
    return { score: scores[post.id] ?? 0, vote, saved, comments: comments.length, solved: comments.some((c) => c.accepted) };
  }, [post.id]);
  const ks = KIND_STYLE[post.kind];
  const mine = !post.sample;

  const open = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });

  return (
    <Card style={{ marginBottom: space.md }}>
      <Pressable onPress={open} accessibilityRole="button"
        accessibilityLabel={`${post.title || 'Personal note'}. ${originBadge(post).label}`}
        style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <IconTile icon={ks.icon} accent={ks.accent} size={42} />
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={2}>{post.title || 'Personal note'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text variant="label">{post.category}</Text>
              <Text variant="small">· {timeAgo(post.createdAt)}</Text>
              {data?.solved ? <Badge label="Solved" tone="ok" /> : null}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: space.sm }}>
          <AuthorTag author={post.author} mine={mine} />
          <Badge {...originBadge(post)} />
        </View>
        {!compact ? <Text variant="body" numberOfLines={3} style={{ marginTop: space.md }}>{post.body}</Text> : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.xs }}>
        <VoteControl score={data?.score ?? 0} vote={data?.vote ?? null} disabled={mine}
          onVote={async (v, reason) => { await repo.setVote('post', post.id, v, reason ?? null); bump(); }} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${data?.comments ?? 0} ${post.kind === 'work_question' ? 'answers' : 'comments'}. Open discussion`}
          onPress={open} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginLeft: space.md }}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.muted} />
          <Text variant="small" style={{ marginLeft: 6 }}>{data?.comments ?? 0}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <IconButton icon={data?.saved ? 'bookmark' : 'bookmark-outline'} label={data?.saved ? 'Remove from saved' : 'Save'} active={data?.saved}
          onPress={async () => { await repo.toggleBookmark('post', post.id); bump(); }} />
        <IconButton icon="ellipsis-vertical" label="More options" onPress={() => showPostMenu(post, repo, bump)} />
      </View>
    </Card>
  );
}
