import { DAILY_ACTIVITY_CAP, POINTS, computeContribution, tierFor } from '@/lib/karma';
import { checkContent } from '@/lib/moderation';
import { periodStats, startOfDay } from '@/lib/moodStats';
import { authorLine } from '@/lib/profileOptions';
import type { Comment, MoodCheckin, Post } from '@/data/types';

const H = 3_600_000;
const post = (id: string, kind: Post['kind'], t: number, sample = false): Post =>
  ({ id, kind, category: 'IT', title: 't', body: 'b', createdAt: t, updatedAt: t, sample, author: null });
const comment = (id: string, postId: string, t: number): Comment =>
  ({ id, postId, body: 'b', createdAt: t, sample: false, author: null, accepted: false });

describe('contribution score', () => {
  const day = new Date(2026, 5, 10, 9).getTime();

  it('rewards answers more than questions and ignores answers to your own question', () => {
    const mine = [post('q1', 'work_question', day)];
    const others = [post('sample-x', 'work_question', day, true)];
    const byId = new Map([...mine, ...others].map((p) => [p.id, p]));
    const c = computeContribution(mine, [comment('c1', 'sample-x', day + H), comment('c2', 'q1', day + 2 * H)], byId);
    expect(c.score).toBe(POINTS.question + POINTS.answer);
  });

  it('caps activity points per day', () => {
    const others = [post('sample-x', 'work_question', day, true)];
    const byId = new Map(others.map((p) => [p.id, p]));
    const many = Array.from({ length: 20 }, (_, i) => comment(`c${i}`, 'sample-x', day + i * 60_000));
    const c = computeContribution([], many, byId);
    expect(c.score).toBe(DAILY_ACTIVITY_CAP);
    expect(c.cappedDays).toBe(1);
  });

  it('counts votes and accepted answers received (phase 2 input)', () => {
    const c = computeContribution([], [], new Map(), { upvotes: 10, downvotes: 2, acceptedByOthers: 1 });
    expect(c.score).toBe(10 - 2 + POINTS.acceptedAnswer);
  });

  it('maps scores to tiers with progress', () => {
    expect(tierFor(0).tier.id).toBe('newcomer');
    expect(tierFor(25).tier.id).toBe('contributor');
    expect(tierFor(800).next).toBeNull();
    expect(tierFor(62).progress).toBeCloseTo((62 - 25) / 75);
  });
});

describe('on-device moderation', () => {
  it('passes ordinary text', () => {
    expect(checkContent('How do I request leave for next month?')).toEqual({ ok: true, issues: [] });
  });

  it('blocks personal attacks and confidential info', () => {
    expect(checkContent('my manager is an idiot').ok).toBe(false);
    expect(checkContent('the confidential roadmap says…').ok).toBe(false);
  });

  it('warns (but allows) personal data and named people', () => {
    const r = checkContent('Email me at someone@example.com — my manager Rahul said so');
    expect(r.ok).toBe(true);
    expect(r.issues.map((i) => i.kind).sort()).toEqual(['email', 'named_person']);
  });

  it('treats self-harm as support, never as a violation', () => {
    const r = checkContent('Some days I want to die');
    expect(r.ok).toBe(true);
    expect(r.issues[0]).toMatchObject({ kind: 'self_harm', severity: 'support' });
  });
});

describe('mood stats', () => {
  const now = new Date(2026, 5, 14, 18).getTime(); // a Sunday evening
  const at = (daysAgo: number, mood: MoodCheckin['mood'], tags: MoodCheckin['tags'] = []): MoodCheckin =>
    ({ id: `${daysAgo}-${mood}`, mood, tags, createdAt: startOfDay(now) - daysAgo * 86_400_000 + 10 * H });

  it('builds 7 daily points ending today, averaging same-day check-ins', () => {
    const s = periodStats([at(0, 'great'), at(0, 'not_great'), at(3, 'okay')], 7, now);
    expect(s.days).toHaveLength(7);
    expect(s.days[6].score).toBe(3);
    expect(s.days[3].score).toBe(3);
    expect(s.days[0].score).toBeNull();
    expect(s.checkinDays).toBe(2);
  });

  it('finds the most common tag on lower days', () => {
    const s = periodStats([at(1, 'struggling', ['workload']), at(2, 'not_great', ['workload', 'sleep']), at(3, 'great', ['team'])], 7, now);
    expect(s.toughDayTag).toEqual({ tag: 'workload', count: 2, of: 2 });
  });

  it('ignores check-ins outside the period', () => {
    expect(periodStats([at(10, 'great')], 7, now).checkinDays).toBe(0);
  });
});

describe('author line', () => {
  it('shows role and experience band, and hides "Other"', () => {
    expect(authorLine({ role: 'intern', experience: 'lt1', verified: true })).toBe('Intern · <1 yr at ABB');
    expect(authorLine({ role: 'other', experience: null, verified: true })).toBeNull();
    expect(authorLine(null)).toBeNull();
  });
});
