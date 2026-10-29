import type { AuthorMeta, NotificationPrefs, PostKind, Profile } from './types';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { dailyReminder: false, resourceTips: false, hydration: false, microBreak: false };

/** Snapshot of what the author chose to show. Names are never included. */
export function authorSnapshot(profile: Profile | null, show: boolean | undefined): AuthorMeta | null {
  if (!show || !profile) return null;
  return { role: profile.role, experience: profile.experience, verified: profile.verified };
}

export function validatePostInput(title: string, body: string, kind: PostKind): string | null {
  if (kind !== 'personal' && title.trim().length < 3) return 'Please add a short title (at least 3 characters).';
  if (kind === 'personal' && body.length > 500) return 'Please keep your note within 500 characters.';
  if (kind !== 'personal' && kind !== 'poll' && body.trim().length < 5) return 'Please add a few words of detail.';
  if (body.length > 500) return 'Please keep your text within 500 characters.';
  return null;
}
