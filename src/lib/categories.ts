import type { PostKind } from '@/data/types';

export const CATEGORIES: Record<PostKind, string[]> = {
  personal: ['Stress & Anxiety', 'Work-life balance', 'Burnout', 'Relationships & family', 'Other'],
  work_question: ['Work Problem', 'Work Question', 'HR', 'IT', 'Workplace', 'Other'],
  achievement: ['Teamwork', 'Learning', 'Safety', 'Quality', 'Innovation', 'Project milestone', 'Customer impact'],
};

export const KIND_LABEL: Record<PostKind, string> = {
  personal: 'Personal Support',
  work_question: 'Work Question',
  achievement: 'Achievement',
};

export const MAX_BODY = 500;

export type FeedFilter = 'all' | 'personal' | 'work' | 'hrit' | 'achievements';
export const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'personal', label: 'Personal' }, { id: 'work', label: 'Work' },
  { id: 'hrit', label: 'HR/IT' }, { id: 'achievements', label: 'Achievements' },
];

export function matchesFilter(p: { kind: PostKind; category: string }, f: FeedFilter): boolean {
  const hrit = p.kind === 'work_question' && (p.category === 'HR' || p.category === 'IT');
  switch (f) {
    case 'personal': return p.kind === 'personal';
    case 'work': return p.kind === 'work_question' && !hrit;
    case 'hrit': return hrit;
    case 'achievements': return p.kind === 'achievement';
    default: return true;
  }
}
