import type { Post, Resource } from '@/data/types';
import type { TopicId } from './topics';

/** Which support category a post or community belongs to, so the feed can follow what the user chose. */
const COMMUNITY_GENRE: Record<string, TopicId> = {
  'mental-wellbeing': 'mental',
  workplace: 'workplace',
  'career-growth': 'career',
  teams: 'team',
  'work-life-balance': 'personal',
  ideas: 'workplace',
  'abb-life': 'team',
};

const CATEGORY_GENRE: Record<string, TopicId> = {
  // personal support
  'Stress & Anxiety': 'mental', Burnout: 'mental', 'Work-life balance': 'personal', 'Relationships & family': 'relationships',
  // questions
  'Work Problem': 'workplace', 'Work Question': 'questions', HR: 'workplace', IT: 'questions', Workplace: 'workplace',
  // achievements
  Teamwork: 'team', Learning: 'career', Safety: 'workplace', Quality: 'workplace', Innovation: 'career',
  'Project milestone': 'team', 'Customer impact': 'career',
  // discussions, polls and ideas
  'Mental wellbeing': 'mental', 'Career growth': 'career', Teams: 'team', 'ABB life': 'team', Wellbeing: 'personal',
  Facilities: 'workplace', Technology: 'questions', Culture: 'team', Process: 'questions', Team: 'team',
};

export function genreOfPost(p: Pick<Post, 'communityId' | 'category' | 'kind'>): TopicId {
  if (p.communityId && COMMUNITY_GENRE[p.communityId]) return COMMUNITY_GENRE[p.communityId];
  if (p.kind === 'personal' && p.category === 'Other') return 'personal';
  return CATEGORY_GENRE[p.category] ?? (p.kind === 'work_question' ? 'questions' : 'personal');
}

export function genreOfCommunity(id: string): TopicId | null {
  return COMMUNITY_GENRE[id] ?? null;
}

/** Posts in the user's chosen categories. With no categories chosen, nothing is filtered out. */
export function forYou<T extends Pick<Post, 'communityId' | 'category' | 'kind'>>(posts: T[], topics: string[]): T[] {
  if (!topics.length) return posts;
  const set = new Set(topics);
  return posts.filter((p) => set.has(genreOfPost(p)));
}

const GENRE_RESOURCES: Record<TopicId, string[]> = {
  mental: ['r-stress', 'r-mindful', 'r-eap'],
  personal: ['r-balance', 'r-wellbeing'],
  relationships: ['r-eap', 'r-faq'],
  career: ['r-hr'],
  team: ['r-policy', 'r-hr'],
  workplace: ['r-workplace', 'r-policy'],
  questions: ['r-faq', 'r-it', 'r-hr'],
};

/** Resources that match the user's categories, in the order they chose them. */
export function resourcesForTopics(resources: Resource[], topics: string[], limit = 3): Resource[] {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const out: Resource[] = [];
  for (const t of topics) {
    for (const id of GENRE_RESOURCES[t as TopicId] ?? []) {
      const r = byId.get(id);
      if (r && !out.includes(r)) out.push(r);
    }
  }
  return out.slice(0, limit);
}
