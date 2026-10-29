import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Repository } from '@/data/repository';
import type { Post } from '@/data/types';
import { originBadge } from '@/lib/origin';

export function confirmDeletePost(post: Post, repo: Repository, onDone: () => void, leaveScreen = false) {
  Alert.alert('Delete this entry?', 'It will be removed from this device. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await repo.deletePost(post.id);
      onDone();
      if (leaveScreen) router.back();
    } },
  ]);
}

export function confirmReport(post: Post, repo: Repository, onDone: () => void) {
  const msg = post.shared
    ? 'Your report is saved with the community data. There is no automatic moderation yet, so it will not be acted on until someone reviews reports.'
    : 'In this version, a report is only noted on this device. No one at ABB, HR or IT receives it, and there is no moderation queue.';
  Alert.alert('Report this content?', msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Note report', onPress: async () => { await repo.reportPost(post.id, 'user_report'); onDone(); } },
  ]);
}

export function showPostMenu(post: Post, repo: Repository, onDone: () => void) {
  const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
  if (!post.sample) {
    buttons.push({ text: 'Edit', onPress: () => router.push({ pathname: '/compose', params: { id: post.id } }) });
    buttons.push({ text: 'Delete', style: 'destructive', onPress: () => confirmDeletePost(post, repo, onDone) });
  }
  buttons.push({ text: 'Report', onPress: () => confirmReport(post, repo, onDone) });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('Options', originBadge(post).label, buttons);
}
