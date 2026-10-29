import { DEMO_MODE, DEMO_RECEIVED } from '@/constants/demo';
import { computeContribution } from '@/lib/karma';
import { useData } from './useData';

/**
 * Contribution score from this device's activity.
 * Phase 2: `received` (votes and accepted answers from colleagues) comes from the server.
 */
export function useContribution() {
  return useData(async (r) => {
    const [posts, comments] = await Promise.all([r.listPosts(), r.listMyComments()]);
    const byId = new Map(posts.map((p) => [p.id, p]));
    return computeContribution(posts.filter((p) => !p.sample), comments, byId, DEMO_MODE ? { ...DEMO_RECEIVED } : undefined);
  });
}
