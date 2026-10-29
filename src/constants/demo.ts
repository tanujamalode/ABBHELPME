/**
 * Prototype switch. While true, finishing onboarding fills the app with MOCK history
 * (two weeks of mood check-ins, a few posts and answers, votes, bookmarks) so every screen has
 * something to show, and the UI says so. Set to false for real use: nothing is seeded.
 */
export const DEMO_MODE = true;

/** Mock feedback "from colleagues" for the contribution score, until the shared community exists (Phase 2). */
export const DEMO_RECEIVED = { upvotes: 18, downvotes: 1, acceptedByOthers: 1 } as const;
