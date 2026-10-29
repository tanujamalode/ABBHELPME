import type { IconName } from '@/components/ui';
import type { Accent } from '@/constants/brand';
import type { FeedbackCategory, ReceivedShoutout, ShoutoutBadge } from '@/data/types';

export const BADGE_META: Record<ShoutoutBadge, { label: string; blurb: string; icon: IconName; accent: Accent }> = {
  thanks: { label: 'Thank you', blurb: 'For help, big or small', icon: 'heart', accent: 'rose' },
  teamwork: { label: 'Team player', blurb: 'For pulling together', icon: 'people', accent: 'blue' },
  above_beyond: { label: 'Above and beyond', blurb: 'For going the extra mile', icon: 'rocket', accent: 'violet' },
  creative: { label: 'Creative spark', blurb: 'For a fresh idea', icon: 'bulb', accent: 'amber' },
  helpful: { label: 'Always helpful', blurb: 'For sharing knowledge', icon: 'hand-left', accent: 'green' },
  kind: { label: 'Kind heart', blurb: 'For making someone\'s day', icon: 'happy', accent: 'teal' },
};

export const FEEDBACK_META: Record<FeedbackCategory, { label: string; icon: IconName }> = {
  workplace: { label: 'Workplace', icon: 'business-outline' },
  wellbeing: { label: 'Wellbeing', icon: 'heart-outline' },
  facilities: { label: 'Facilities', icon: 'construct-outline' },
  management: { label: 'Management', icon: 'people-outline' },
  technology: { label: 'Technology', icon: 'laptop-outline' },
  culture: { label: 'Culture', icon: 'sparkles-outline' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
};

/** Badges a person has received, most common first. There is deliberately no ranking between people. */
export function badgeTally(received: Pick<ReceivedShoutout, 'badge'>[]): { badge: ShoutoutBadge; count: number }[] {
  const counts = new Map<ShoutoutBadge, number>();
  for (const r of received) counts.set(r.badge, (counts.get(r.badge) ?? 0) + 1);
  return [...counts].map(([badge, count]) => ({ badge, count })).sort((a, b) => b.count - a.count);
}

/** "May 2026" for the feedback report. */
export const monthTitle = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export function shiftMonth(d: Date, by: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + by, 1);
}

/** Change against the previous month, in words. Null when the previous month is too small to compare. */
export function changeNote(count: number, previous: number | null): string | null {
  if (previous == null) return null;
  if (count === previous) return 'About the same as last month';
  return count > previous ? `Up from ${previous} last month` : `Down from ${previous} last month`;
}
