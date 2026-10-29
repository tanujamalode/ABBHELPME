import type { PostKind } from '@/data/types';

export const CATEGORIES: Record<PostKind, string[]> = {
  personal: ['Stress & Anxiety', 'Work-life balance', 'Burnout', 'Relationships & family', 'Other'],
  work_question: ['Work Problem', 'Work Question', 'HR', 'IT', 'Workplace', 'Other'],
  achievement: ['Teamwork', 'Learning', 'Safety', 'Quality', 'Innovation', 'Project milestone', 'Customer impact'],
  discussion: ['Mental wellbeing', 'Workplace', 'Career growth', 'Teams', 'Work-life balance', 'ABB life'],
  poll: ['Workplace', 'Wellbeing', 'Team', 'Culture', 'ABB life'],
  idea: ['Workplace', 'Wellbeing', 'Facilities', 'Technology', 'Culture', 'Process'],
};

export const KIND_LABEL: Record<PostKind, string> = {
  personal: 'Personal Support',
  work_question: 'Work Question',
  achievement: 'Achievement',
  discussion: 'Discussion',
  poll: 'Poll',
  idea: 'Idea',
};

export const MAX_BODY = 500;
export const MAX_ATTACHMENTS = 4;

export type FeedFilter = 'foryou' | 'all' | 'personal' | 'work' | 'hrit' | 'discussions' | 'polls' | 'achievements';
export const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'foryou', label: 'For you' }, { id: 'all', label: 'All' }, { id: 'personal', label: 'Personal' }, { id: 'work', label: 'Work' },
  { id: 'hrit', label: 'HR/IT' }, { id: 'discussions', label: 'Discussions & ideas' }, { id: 'polls', label: 'Polls' },
  { id: 'achievements', label: 'Achievements' },
];

/** 'foryou' is applied separately (it depends on the user's chosen categories). */
export function matchesFilter(p: { kind: PostKind; category: string }, f: FeedFilter): boolean {
  const hrit = p.kind === 'work_question' && (p.category === 'HR' || p.category === 'IT');
  switch (f) {
    case 'personal': return p.kind === 'personal';
    case 'work': return p.kind === 'work_question' && !hrit;
    case 'hrit': return hrit;
    case 'discussions': return p.kind === 'discussion' || p.kind === 'idea';
    case 'polls': return p.kind === 'poll';
    case 'achievements': return p.kind === 'achievement';
    default: return true;
  }
}
