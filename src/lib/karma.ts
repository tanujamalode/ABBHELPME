import type { Comment, Post, Vote } from '@/data/types';

/**
 * Contribution score ("karma"). Rewards helpfulness, not popularity.
 *
 * Rules shown to users:
 * - Never used in performance reviews and not linked to your identity.
 * - Votes on your own content don't count; neither do answers you accept on your own questions.
 * - Activity points are capped per day so the score can't be farmed.
 *
 * Phase 1 only has this device's data, so "received" votes come from the shared
 * community in Phase 2. `received` is accepted here so the server can reuse this.
 */
export const POINTS = {
  question: 2,
  answer: 5,
  supportComment: 2,
  achievement: 3,
  acceptedAnswer: 15,
  upvoteReceived: 1,
  downvoteReceived: -1,
} as const;

export const DAILY_ACTIVITY_CAP = 30;

export const TIERS = [
  { id: 'newcomer', label: 'Newcomer', min: 0, icon: 'leaf' },
  { id: 'contributor', label: 'Contributor', min: 25, icon: 'star-half' },
  { id: 'helper', label: 'Helper', min: 100, icon: 'star' },
  { id: 'trusted', label: 'Trusted Helper', min: 300, icon: 'shield-checkmark' },
  { id: 'expert', label: 'Expert', min: 750, icon: 'trophy' },
] as const;
export type Tier = (typeof TIERS)[number];

export interface ReceivedFeedback {
  upvotes: number;
  downvotes: number;
  /** Answers of mine accepted by someone else. */
  acceptedByOthers: number;
}

export interface Contribution {
  score: number;
  tier: Tier;
  next: Tier | null;
  /** 0..1 progress to the next tier. */
  progress: number;
  breakdown: { label: string; count: number; points: number }[];
  /** Category with the most answers, for an "Active in IT" style badge. */
  topCategory: string | null;
  cappedDays: number;
}

const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

export function tierFor(score: number): { tier: Tier; next: Tier | null; progress: number } {
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) if (score >= TIERS[k].min) i = k;
  const tier = TIERS[i];
  const next = TIERS[i + 1] ?? null;
  const progress = next ? Math.min(1, (score - tier.min) / (next.min - tier.min)) : 1;
  return { tier, next, progress };
}

/**
 * @param myPosts posts written on this device (not samples)
 * @param myComments comments written on this device (not samples)
 * @param postsById lookup used to tell answers (on questions) from support comments
 */
export function computeContribution(
  myPosts: Post[],
  myComments: Comment[],
  postsById: Map<string, Post>,
  received: ReceivedFeedback = { upvotes: 0, downvotes: 0, acceptedByOthers: 0 },
): Contribution {
  const events: { t: number; pts: number; kind: 'question' | 'answer' | 'support' | 'achievement' }[] = [];
  for (const p of myPosts) {
    if (p.sample) continue;
    if (p.kind === 'work_question') events.push({ t: p.createdAt, pts: POINTS.question, kind: 'question' });
    else if (p.kind === 'achievement') events.push({ t: p.createdAt, pts: POINTS.achievement, kind: 'achievement' });
  }
  const answerCats = new Map<string, number>();
  for (const c of myComments) {
    if (c.sample) continue;
    const parent = postsById.get(c.postId);
    // Answering your own question earns nothing.
    if (parent && !parent.sample && myPosts.some((p) => p.id === parent.id)) continue;
    if (parent?.kind === 'work_question') {
      events.push({ t: c.createdAt, pts: POINTS.answer, kind: 'answer' });
      answerCats.set(parent.category, (answerCats.get(parent.category) ?? 0) + 1);
    } else {
      events.push({ t: c.createdAt, pts: POINTS.supportComment, kind: 'support' });
    }
  }

  // Apply the daily cap in time order.
  events.sort((a, b) => a.t - b.t);
  const perDay = new Map<string, number>();
  const counted = { question: [0, 0], answer: [0, 0], support: [0, 0], achievement: [0, 0] } as Record<string, [number, number]>;
  const capped = new Set<string>();
  for (const e of events) {
    const k = dayKey(e.t);
    const used = perDay.get(k) ?? 0;
    const pts = Math.max(0, Math.min(e.pts, DAILY_ACTIVITY_CAP - used));
    if (pts < e.pts) capped.add(k);
    perDay.set(k, used + pts);
    counted[e.kind][0] += 1;
    counted[e.kind][1] += pts;
  }

  const breakdown = [
    { label: 'Answers to questions', count: counted.answer[0], points: counted.answer[1] },
    { label: 'Supportive comments', count: counted.support[0], points: counted.support[1] },
    { label: 'Questions asked', count: counted.question[0], points: counted.question[1] },
    { label: 'Achievements shared', count: counted.achievement[0], points: counted.achievement[1] },
    { label: 'Accepted answers', count: received.acceptedByOthers, points: received.acceptedByOthers * POINTS.acceptedAnswer },
    { label: 'Votes from colleagues', count: received.upvotes + received.downvotes,
      points: received.upvotes * POINTS.upvoteReceived + received.downvotes * POINTS.downvoteReceived },
  ];
  const score = Math.max(0, breakdown.reduce((s, b) => s + b.points, 0));

  let topCategory: string | null = null;
  let best = 0;
  for (const [cat, n] of answerCats) if (n > best) { best = n; topCategory = cat; }

  return { score, ...tierFor(score), breakdown, topCategory: best >= 3 ? topCategory : null, cappedDays: capped.size };
}

/** Score shown next to a post or answer: sample baseline plus this device's vote. */
export function displayScore(base: number, myVote: Vote | null): number {
  return base + (myVote?.value ?? 0);
}
