import type { Post } from '@/data/types';

/** Badge text for who wrote a post. Personal posts are anonymous to colleagues unless the author opts in. */
export function originBadge(x: Pick<Post, 'mine'>): { label: string; tone: 'local' } {
  return { label: x.mine ? 'Shared by you' : 'Colleague', tone: 'local' };
}
