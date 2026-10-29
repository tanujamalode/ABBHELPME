import { RESOURCE_OVERRIDES } from './resourceConfig';
import { SAMPLE_COMMENT_SCORES, SAMPLE_REACTIONS, SEED_RESOURCES, getSampleComments, getSamplePosts } from './seed';
import type { AuthorMeta, Comment, NotificationPrefs, Post, PostKind, Profile, Resource, VoteTarget } from './types';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { dailyReminder: false, resourceTips: false };

export const isSampleId = (id: string) => id.startsWith('sample-');

/** Local entries first-class; samples appended, always flagged. Newest first. */
export function mergePosts(local: Post[], kind?: PostKind): Post[] {
  const all = [...local, ...getSamplePosts()];
  return all.filter((p) => !kind || p.kind === kind).sort((a, b) => b.createdAt - a.createdAt);
}

export function mergeComments(local: Comment[], postId: string, acceptedId?: string | null): Comment[] {
  const mine = local.map((c) => ({ ...c, accepted: c.id === acceptedId }));
  return [...getSampleComments().filter((c) => c.postId === postId), ...mine]
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Snapshot of what the author chose to show. Names are never included. */
export function authorSnapshot(profile: Profile | null, show: boolean | undefined): AuthorMeta | null {
  if (!show || !profile) return null;
  return { role: profile.role, experience: profile.experience, verified: profile.verified };
}

export function resolveResources(): Resource[] {
  return SEED_RESOURCES.map((r) => ({ ...r, ...(RESOURCE_OVERRIDES[r.id] ?? {}) }));
}

export const sampleScoreBase = (target: VoteTarget, id: string) =>
  (target === 'post' ? SAMPLE_REACTIONS[id] : SAMPLE_COMMENT_SCORES[id]) ?? 0;

export function validatePostInput(title: string, body: string, kind: PostKind): string | null {
  if (kind !== 'personal' && title.trim().length < 3) return 'Please add a short title (at least 3 characters).';
  if (kind === 'personal' && body.length > 500) return 'Please keep your note within 500 characters.';
  if (kind !== 'personal' && body.trim().length < 5) return 'Please add a few words of detail.';
  if (body.length > 500) return 'Please keep your text within 500 characters.';
  return null;
}
