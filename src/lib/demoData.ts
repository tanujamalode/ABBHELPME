import type { Repository } from '@/data/repository';
import type { Mood, MoodTag } from '@/data/types';
import { startOfDay } from '@/lib/moodStats';

const DAY = 86_400_000;
const H = 3_600_000;

/** [daysAgo, mood, tags]: yesterday back to 13 days ago. Today is left empty so Capy invites a check-in. */
const MOODS: [number, Mood, MoodTag[]][] = [
  [1, 'okay', ['workload']], [2, 'great', ['recognition', 'team']], [3, 'okay', ['sleep']], [4, 'not_great', ['workload', 'sleep']],
  [5, 'great', ['learning']], [6, 'okay', []], [7, 'not_great', ['workload']], [8, 'okay', ['team']],
  [9, 'great', ['recognition']], [10, 'struggling', ['workload', 'family']], [11, 'not_great', ['workload', 'sleep']],
  [12, 'okay', ['learning']], [13, 'great', ['team', 'learning']],
];

/**
 * Writes mock data through the public repository API, so it works with any Repository
 * (including a future API one). Everything is backdated; nothing is written for "today".
 */
export async function seedDemoData(repo: Repository, now: number = Date.now()): Promise<void> {
  // Anchored to the start of each day, so evening runs can't spill a check-in into today.
  const today = startOfDay(now);
  for (const [d, mood, tags] of MOODS) await repo.addMoodCheckin(mood, tags, today - d * DAY + 10 * H);

  // Questions, an achievement and a personal note written "by me".
  await repo.createPost({ kind: 'work_question', category: 'IT', title: 'How do I request a second monitor?',
    body: 'I work from the office three days a week. Is there a form for ergonomic equipment, and how long does it usually take?',
    showAuthor: true, createdAt: now - 4 * DAY });
  await repo.createPost({ kind: 'work_question', category: 'HR', title: 'What counts as a team-building day?',
    body: 'Our lead mentioned a budget for team events. Does anyone know how to claim it?', showAuthor: true, createdAt: now - 9 * DAY });
  await repo.createPost({ kind: 'achievement', category: 'Learning', title: 'Finished my first safety certification',
    body: 'Passed the site safety course this week. Thanks to everyone who shared their study notes.', showAuthor: true, createdAt: now - 6 * DAY });
  await repo.createPost({ kind: 'personal', category: 'Work-life balance', title: '',
    body: 'Trying to stop checking email after 7pm this week. Day two and it already feels lighter.', showAuthor: false, createdAt: now - 2 * DAY });

  // Answers on the sample questions, spread over several days (the daily cap is 30 points).
  const answers: [string, string, number][] = [
    ['sample-vpn', 'Switching from Wi-Fi to the 5 GHz band fixed the random disconnects for me.', 7],
    ['sample-stress', 'A short walk between meetings has helped me reset. Even ten minutes counts.', 5],
    ['sample-transfer', 'Ask your manager for a career conversation first; HR usually wants that before a transfer.', 3],
    ['sample-vpn', 'If it still drops, a ticket with the exact time of the disconnect helps IT trace it.', 1],
  ];
  for (const [postId, body, d] of answers) await repo.addComment(postId, body, true, today - d * DAY + 14 * H);

  // Votes and bookmarks on sample content.
  await repo.setVote('post', 'sample-vpn', 1);
  await repo.setVote('post', 'sample-stress', 1);
  await repo.setVote('comment', 'sample-c3', 1);
  await repo.setVote('comment', 'sample-c4', -1, 'Not helpful');
  await repo.toggleBookmark('resource', 'r-stress');
  await repo.toggleBookmark('resource', 'r-balance');
  await repo.toggleBookmark('post', 'sample-transfer');
}
