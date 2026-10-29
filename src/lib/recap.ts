import type { Bookmark, MoodCheckin, Post } from '@/data/types';

export interface Recap {
  entriesWritten: number;
  personalEntries: number;
  workQuestions: number;
  achievements: number;
  resourcesSaved: number;
  moodCheckins: number;
  topicsExplored: number;
}

export function monthRange(year: number, month0: number): [number, number] {
  return [new Date(year, month0, 1).getTime(), new Date(year, month0 + 1, 1).getTime()];
}

const within = (t: number, [a, b]: [number, number]) => t >= a && t < b;

/** Counts only the user's own local records. No scoring, no judgments. */
export function computeRecap(
  posts: Post[],
  bookmarks: Bookmark[],
  moods: MoodCheckin[],
  selectedTopicIds: string[],
  year: number,
  month0: number,
): Recap {
  const range = monthRange(year, month0);
  const mine = posts.filter((p) => !p.sample && within(p.createdAt, range));
  return {
    entriesWritten: mine.length,
    personalEntries: mine.filter((p) => p.kind === 'personal').length,
    workQuestions: mine.filter((p) => p.kind === 'work_question').length,
    achievements: mine.filter((p) => p.kind === 'achievement').length,
    resourcesSaved: bookmarks.filter((b) => b.type === 'resource' && within(b.createdAt, range)).length,
    moodCheckins: moods.filter((m) => within(m.createdAt, range)).length,
    topicsExplored: selectedTopicIds.length,
  };
}
