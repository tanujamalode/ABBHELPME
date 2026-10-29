import { computeContribution } from '@/lib/karma';
import type { Post } from '@/data/types';
import { useData } from './useData';

/** Contribution score from the user's own activity plus the votes and accepted answers colleagues gave them. */
export function useContribution() {
  return useData(async (r) => {
    const [posts, comments, received] = await Promise.all([r.listPosts(), r.listMyComments(), r.getReceivedFeedback()]);
    const byId = new Map<string, Post>(posts.map((p) => [p.id, p]));
    // The feed is capped, so fetch the parents of older answers to tell answers from supportive comments.
    const missing = [...new Set(comments.map((c) => c.postId))].filter((id) => !byId.has(id));
    for (const p of await Promise.all(missing.map((id) => r.getPost(id)))) if (p) byId.set(p.id, p);
    return computeContribution(posts.filter((p) => p.mine), comments, byId, received);
  });
}
