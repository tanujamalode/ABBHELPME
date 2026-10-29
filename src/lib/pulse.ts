import type { Mood, MoodCheckin, MoodTag } from '@/data/types';
import { MOOD_SCORE, TAG_LABEL } from './moodStats';

/**
 * Wellbeing Pulse: which factors go with better or harder days, from the user's own check-ins.
 * Described gently and never as a judgment. Needs a few check-ins before it says anything.
 */
export interface FactorInsight {
  tag: MoodTag;
  count: number;
  avgWith: number;
  avgWithout: number | null;
  /** avgWith minus avgWithout, or null when there are too few other days to compare. */
  delta: number | null;
}

const MIN_WITH = 2;
const MIN_WITHOUT = 2;
const DAY = 86_400_000;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function factorInsights(moods: MoodCheckin[], days = 30, now = Date.now()): FactorInsight[] {
  const recent = moods.filter((m) => m.createdAt >= now - days * DAY);
  const tags = new Set<MoodTag>(recent.flatMap((m) => m.tags));
  const out: FactorInsight[] = [];
  for (const tag of tags) {
    const withTag = recent.filter((m) => m.tags.includes(tag)).map((m) => MOOD_SCORE[m.mood]);
    if (withTag.length < MIN_WITH) continue;
    const without = recent.filter((m) => !m.tags.includes(tag)).map((m) => MOOD_SCORE[m.mood]);
    const avgWith = mean(withTag);
    const avgWithout = without.length >= MIN_WITHOUT ? mean(without) : null;
    out.push({ tag, count: withTag.length, avgWith, avgWithout, delta: avgWithout == null ? null : avgWith - avgWithout });
  }
  return out.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** One calm sentence per factor. */
export function factorSentence(f: FactorInsight): string {
  const label = TAG_LABEL[f.tag];
  if (f.delta == null) return `You tagged ${label} on ${f.count} check-ins. Keep going to see how it relates to your days.`;
  if (Math.abs(f.delta) < 0.25) return `${label} doesn't seem to change how your days feel (${f.count} check-ins).`;
  return f.delta > 0
    ? `Days tagged ${label} tend to feel brighter than your others (${f.count} check-ins).`
    : `Days tagged ${label} tend to feel a bit heavier than your others (${f.count} check-ins).`;
}

/** The three the app calls out by name: workload, sleep, and team or workplace factors. */
export const FOCUS_TAGS: MoodTag[] = ['workload', 'sleep', 'team'];

export function focusInsights(moods: MoodCheckin[], now = Date.now()): FactorInsight[] {
  const all = factorInsights(moods, 30, now);
  return FOCUS_TAGS.map((t) => all.find((f) => f.tag === t)).filter((f): f is FactorInsight => !!f);
}

/** Share of check-ins at each mood across colleagues, as rounded percentages. */
export function moodShares(rows: { mood: Mood; count: number }[]): { mood: Mood; pct: number }[] {
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (!total) return [];
  return (['great', 'okay', 'not_great', 'struggling'] as Mood[]).map((mood) => ({
    mood, pct: Math.round(((rows.find((r) => r.mood === mood)?.count ?? 0) / total) * 100),
  }));
}
