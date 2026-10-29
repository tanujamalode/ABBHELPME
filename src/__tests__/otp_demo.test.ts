import { MemoryRepository } from '@/data/memoryRepository';
import { seedDemoData } from '@/lib/demoData';
import { computeContribution } from '@/lib/karma';
import { periodStats } from '@/lib/moodStats';
import {
  DEMO_CODE, OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, createDemoVerifier, isValidEmail,
} from '@/lib/verification';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `id-${++n}` };
});

describe('mock OTP verification', () => {
  const t0 = 1_000_000;

  it('validates the work email shape', () => {
    expect(isValidEmail('asha@abb.com')).toBe(true);
    expect(isValidEmail(' asha@abb.com ')).toBe(true);
    expect(isValidEmail('asha@abb')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
  });

  it('accepts the demo code and shows it only in the challenge', async () => {
    const v = createDemoVerifier();
    const c = await v.requestCode('asha@abb.com', t0);
    expect(c.demoCode).toBe(DEMO_CODE);
    expect(c.resendAt).toBe(t0 + OTP_RESEND_MS);
    expect(await v.confirmCode('asha@abb.com', DEMO_CODE, t0 + 1000)).toEqual({ ok: true });
  });

  it('counts wrong tries, then locks until a new code is requested', async () => {
    const v = createDemoVerifier();
    await v.requestCode('a@b.co', t0);
    const first = await v.confirmCode('a@b.co', '000000', t0);
    expect(first).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: OTP_MAX_ATTEMPTS - 1 });
    await v.confirmCode('a@b.co', '000000', t0);
    expect(await v.confirmCode('a@b.co', '000000', t0)).toMatchObject({ ok: false, reason: 'locked' });
    expect(await v.confirmCode('a@b.co', DEMO_CODE, t0)).toMatchObject({ ok: false, reason: 'locked' });
    await v.requestCode('a@b.co', t0);
    expect(await v.confirmCode('a@b.co', DEMO_CODE, t0)).toEqual({ ok: true });
  });

  it('expires and rejects a different email', async () => {
    const v = createDemoVerifier();
    await v.requestCode('a@b.co', t0);
    expect(await v.confirmCode('a@b.co', DEMO_CODE, t0 + OTP_TTL_MS + 1)).toMatchObject({ ok: false, reason: 'expired' });
    await v.requestCode('a@b.co', t0);
    expect(await v.confirmCode('other@b.co', DEMO_CODE, t0)).toMatchObject({ ok: false, reason: 'no_code' });
  });
});

describe('demo data', () => {
  it('fills mood history, posts, answers, votes and bookmarks, leaving today empty', async () => {
    const repo = new MemoryRepository();
    const now = new Date(2026, 5, 15, 12).getTime();
    await seedDemoData(repo, now);

    const week = periodStats(await repo.listMoodCheckins(), 7, now);
    expect(week.days[week.days.length - 1].score).toBeNull(); // today: Capy invites a check-in
    expect(week.checkinDays).toBe(6);
    expect(week.toughDayTag?.tag).toBe('workload');

    const posts = (await repo.listPosts()).filter((p) => !p.sample);
    expect(posts).toHaveLength(4);
    expect(posts.some((p) => p.kind === 'personal' && p.author === null)).toBe(true);
    expect((await repo.listBookmarks()).length).toBe(3);

    const mine = await repo.listMyComments();
    expect(mine).toHaveLength(4);
    const all = await repo.listPosts();
    const c = computeContribution(posts, mine, new Map(all.map((p) => [p.id, p])));
    expect(c.score).toBeGreaterThanOrEqual(25); // at least Contributor from own activity
  });
});

describe('demo data at any time of day', () => {
  it.each([1, 9, 15, 23])('leaves today empty when seeded at %i:30', async (hour) => {
    const repo = new MemoryRepository();
    const now = new Date(2026, 5, 15, hour, 30).getTime();
    await seedDemoData(repo, now);
    const week = periodStats(await repo.listMoodCheckins(), 7, now);
    expect(week.days[week.days.length - 1].score).toBeNull();
    expect(week.checkinDays).toBe(6);
    for (const c of await repo.listMyComments()) expect(c.createdAt).toBeLessThan(now);
  });
});

describe('downvotes on every item', () => {
  it('lets a post be downvoted with a reason, and needs the reason', async () => {
    const repo = new MemoryRepository();
    await expect(repo.setVote('post', 'sample-vpn', -1)).rejects.toThrow();
    await repo.setVote('post', 'sample-vpn', -1, 'Off-topic');
    const base = (await repo.getScores('post', ['sample-vpn']))['sample-vpn'];
    expect(base).toBe(54 - 1);
    await repo.setVote('post', 'sample-vpn', null);
    expect((await repo.getScores('post', ['sample-vpn']))['sample-vpn']).toBe(54);
  });
});
