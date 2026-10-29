import { MIN_TOPIC_COUNT, TOPIC_CATALOGUE, canContinue, toggleTopic } from '@/lib/topics';
import { forYou, genreOfPost, resourcesForTopics } from '@/lib/personalize';
import { CATEGORIES } from '@/lib/categories';
import type { PostKind, Resource } from '@/data/types';

const topicIds = () => TOPIC_CATALOGUE.map((t) => t.id as string);

describe('seven support categories', () => {
  const ids = topicIds();

  it('offers the seven categories and needs at least one', () => {
    expect(ids).toEqual(['mental', 'workplace', 'relationships', 'career', 'team', 'personal', 'questions']);
    expect(MIN_TOPIC_COUNT).toBe(1);
    expect(canContinue([])).toBe(false);
    expect(canContinue(toggleTopic([], ids[0]))).toBe(true);
  });

  it('allows selecting every category and deselecting again', () => {
    let sel: string[] = [];
    for (const id of ids) sel = toggleTopic(sel, id);
    expect(sel).toHaveLength(7);
    sel = toggleTopic(sel, ids[0]);
    expect(sel).toHaveLength(6);
  });
});

describe('personalisation', () => {
  const post = (kind: PostKind, category: string, communityId: string | null = null) => ({ kind, category, communityId });

  it('maps every category of every kind to a support category', () => {
    for (const kind of Object.keys(CATEGORIES) as PostKind[]) {
      for (const category of CATEGORIES[kind]) expect(topicIds()).toContain(genreOfPost(post(kind, category)));
    }
  });

  it('prefers the community over the category', () => {
    expect(genreOfPost(post('discussion', 'ABB life', 'career-growth'))).toBe('career');
  });

  it('filters "For you" by the chosen categories, and shows everything when none are chosen', () => {
    const posts = [post('personal', 'Burnout'), post('work_question', 'IT'), post('achievement', 'Learning')];
    expect(forYou(posts, ['mental'])).toEqual([posts[0]]);
    expect(forYou(posts, ['questions', 'career'])).toEqual([posts[1], posts[2]]);
    expect(forYou(posts, [])).toEqual(posts);
  });

  it('suggests resources for the chosen categories, without duplicates', () => {
    const r = (id: string): Resource => ({ id, group: 'wellbeing', title: id, subtitle: '', body: '', verified: false, source: 'ABB', reviewedAt: null });
    const all = ['r-stress', 'r-mindful', 'r-eap', 'r-balance', 'r-faq', 'r-hr'].map(r);
    expect(resourcesForTopics(all, ['mental', 'relationships'], 10).map((x) => x.id)).toEqual(['r-stress', 'r-mindful', 'r-eap', 'r-faq']);
    expect(resourcesForTopics(all, [], 10)).toEqual([]);
  });
});
