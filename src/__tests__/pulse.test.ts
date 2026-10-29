import { factorInsights, factorSentence, focusInsights, moodShares } from '@/lib/pulse';
import type { Mood, MoodCheckin, MoodTag } from '@/data/types';

const DAY = 86_400_000;
const now = new Date(2026, 5, 15, 12).getTime();
const m = (daysAgo: number, mood: Mood, tags: MoodTag[] = []): MoodCheckin => ({ id: `${daysAgo}${mood}${tags.join()}`, mood, tags, createdAt: now - daysAgo * DAY });

describe('wellbeing pulse factors', () => {
  const moods = [
    m(1, 'not_great', ['workload']), m(2, 'struggling', ['workload', 'sleep']), m(3, 'not_great', ['workload']),
    m(4, 'great'), m(5, 'great', ['team']), m(6, 'okay'), m(7, 'great', ['team']),
  ];

  it('finds factors that go with harder or brighter days', () => {
    const f = factorInsights(moods, 30, now);
    const workload = f.find((x) => x.tag === 'workload')!;
    expect(workload.count).toBe(3);
    expect(workload.delta!).toBeLessThan(-0.25);
    expect(factorSentence(workload)).toContain('heavier');
    const team = f.find((x) => x.tag === 'team')!;
    expect(team.delta!).toBeGreaterThan(0.25);
    expect(factorSentence(team)).toContain('brighter');
  });

  it('says nothing about a factor tagged only once', () => {
    expect(factorInsights(moods, 30, now).some((x) => x.tag === 'sleep')).toBe(false);
  });

  it('only looks inside the window', () => {
    expect(factorInsights(moods, 1, now)).toEqual([]);
  });

  it('calls out workload, sleep and team in that order when there is data', () => {
    const more = [...moods, m(8, 'okay', ['sleep']), m(9, 'not_great', ['sleep'])];
    expect(focusInsights(more, now).map((x) => x.tag)).toEqual(['workload', 'sleep', 'team']);
  });

  it('does not compare when there are too few other days', () => {
    const few = [m(1, 'okay', ['sleep']), m(2, 'okay', ['sleep']), m(3, 'great')];
    const f = factorInsights(few, 30, now)[0];
    expect(f.delta).toBeNull();
    expect(factorSentence(f)).toContain('Keep going');
  });
});

describe('colleague mood shares', () => {
  it('turns counts into percentages and handles empty input', () => {
    expect(moodShares([{ mood: 'great', count: 3 }, { mood: 'okay', count: 1 }])).toEqual([
      { mood: 'great', pct: 75 }, { mood: 'okay', pct: 25 }, { mood: 'not_great', pct: 0 }, { mood: 'struggling', pct: 0 },
    ]);
    expect(moodShares([])).toEqual([]);
  });
});
