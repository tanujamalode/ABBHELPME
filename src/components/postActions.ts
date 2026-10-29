import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Repository } from '@/data/repository';
import type { Post } from '@/data/types';
import { attempt } from '@/lib/attempt';
import { originBadge } from '@/lib/origin';

export function confirmDeletePost(post: Post, repo: Repository, onDone: () => void, leaveScreen = false) {
  Alert.alert('Delete this post?', 'It will be removed for everyone, together with its answers. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      const done = await attempt(async () => { await repo.deletePost(post.id); return true; }, 'delete that');
      if (!done) return;
      onDone();
      if (leaveScreen) router.back();
    } },
  ]);
}

export function confirmReport(post: Post, repo: Repository, onDone: () => void) {
  Alert.alert('Report this post?',
    'Your report is anonymous. Once three different people report a post it is hidden from the community. No one at HR or IT is contacted automatically.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', onPress: async () => {
        const done = await attempt(async () => { await repo.reportPost(post.id, 'user_report'); return true; }, 'send your report');
        if (done) { Alert.alert('Thanks', 'Your report was recorded.'); onDone(); }
      } },
    ]);
}

export function showPostMenu(post: Post, repo: Repository, onDone: () => void) {
  const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
  if (post.mine) {
    buttons.push({ text: 'Edit', onPress: () => router.push({ pathname: '/compose', params: { id: post.id } }) });
    buttons.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDeletePost(post, repo, onDone) });
  }
  if (!post.mine) buttons.push({ text: 'Report', onPress: () => confirmReport(post, repo, onDone) });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('Options', originBadge(post).label, buttons);
}
