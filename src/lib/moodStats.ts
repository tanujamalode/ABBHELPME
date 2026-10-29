import type { Accent } from '@/constants/brand';
import type { Mood, MoodCheckin, MoodTag } from '@/data/types';

/** Ordinal scale used only for personal trends on this device. */
export const MOOD_SCORE: Record<Mood, number> = { great: 4, okay: 3, not_great: 2, struggling: 1 };
export const MOOD_LABEL: Record<Mood, string> = { great: 'Great', okay: 'Okay', not_great: 'Not great', struggling: 'Struggling' };
/** Weather scale instead of emoji faces: Ionicons names and the accent each mood uses. */
export const MOOD_ICON = { great: 'sunny', okay: 'partly-sunny', not_great: 'cloudy', struggling: 'rainy' } as const satisfies Record<Mood, string>;
export const MOOD_ACCENT: Record<Mood, Accent> = { great: 'green', okay: 'amber', not_great: 'slate', struggling: 'rose' };
export const TAG_LABEL: Record<MoodTag, string> = {
  workload: 'Workload', sleep: 'Sleep', team: 'Team', family: 'Family', health: 'Health', learning: 'Learning', recognition: 'Recognition',
};

export interface DayPoint {
  /** Local midnight of the day. */
  day: number;
  /** Average score that day, or null if no check-in. */
  score: number | null;
  /** Mood nearest the average, for the emoji label. */
  mood: Mood | null;
  count: number;
}

export interface PeriodStats {
  days: DayPoint[];
  checkinDays: number;
  average: number | null;
  /** Average mood label, e.g. "Okay". */
  averageMood: Mood | null;
  topTags: { tag: MoodTag; count: number }[];
  /** Most frequent tag on lower days (score <= 2), e.g. "workload". */
  toughDayTag: { tag: MoodTag; count: number; of: number } | null;
  /** Weekday with the highest average (0 = Sunday), when there is enough data. */
  bestWeekday: number | null;
  /** Change in average vs the previous period of the same length. */
  delta: number | null;
}

const DAY = 86_400_000;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

function nearestMood(score: number): Mood {
  const r = Math.round(score);
  return r >= 4 ? 'great' : r === 3 ? 'okay' : r === 2 ? 'not_great' : 'struggling';
}

function series(moods: MoodCheckin[], from: number, days: number): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    // Step by calendar day (not 24h) so DST changes don't shift buckets.
    const d = new Date(from); d.setDate(d.getDate() + i);
    const start = d.getTime();
    const end = (() => { const e = new Date(start); e.setDate(e.getDate() + 1); return e.getTime(); })();
    const hits = moods.filter((m) => m.createdAt >= start && m.createdAt < end);
    const score = hits.length ? hits.reduce((s, m) => s + MOOD_SCORE[m.mood], 0) / hits.length : null;
    out.push({ day: start, score, mood: score == null ? null : nearestMood(score), count: hits.length });
  }
  return out;
}

const avg = (pts: DayPoint[]) => {
  const xs = pts.map((p) => p.score).filter((s): s is number => s != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

/** Stats for the last `days` days ending today (inclusive). */
export function periodStats(moods: MoodCheckin[], days: 7 | 30, now: number = Date.now()): PeriodStats {
  const today = startOfDay(now);
  const fromDate = new Date(today); fromDate.setDate(fromDate.getDate() - (days - 1));
  const from = fromDate.getTime();
  const end = today + DAY;
  const pts = series(moods, from, days);
  const inRange = moods.filter((m) => m.createdAt >= from && m.createdAt < end);

  const tagCount = new Map<MoodTag, number>();
  const toughTags = new Map<MoodTag, number>();
  let toughCount = 0;
  for (const m of inRange) {
    for (const t of m.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    if (MOOD_SCORE[m.mood] <= 2) {
      toughCount++;
      for (const t of m.tags) toughTags.set(t, (toughTags.get(t) ?? 0) + 1);
    }
  }
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag, count]) => ({ tag, count }));
  const tough = [...toughTags.entries()].sort((a, b) => b[1] - a[1])[0];

  // Best weekday needs at least two check-in days on that weekday to be meaningful.
  const byWeekday = new Map<number, number[]>();
  for (const p of pts) if (p.score != null) {
    const w = new Date(p.day).getDay();
    byWeekday.set(w, [...(byWeekday.get(w) ?? []), p.score]);
  }
  let bestWeekday: number | null = null;
  let bestAvg = -1;
  for (const [w, xs] of byWeekday) {
    if (xs.length < 2) continue;
    const a = xs.reduce((s, x) => s + x, 0) / xs.length;
    if (a > bestAvg) { bestAvg = a; bestWeekday = w; }
  }

  const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - days);
  const prev = avg(series(moods, prevFrom.getTime(), days));
  const average = avg(pts);

  return {
    days: pts,
    checkinDays: pts.filter((p) => p.count > 0).length,
    average,
    averageMood: average == null ? null : nearestMood(average),
    topTags,
    toughDayTag: tough ? { tag: tough[0], count: tough[1], of: toughCount } : null,
    bestWeekday,
    delta: average != null && prev != null ? average - prev : null,
  };
}

export const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
