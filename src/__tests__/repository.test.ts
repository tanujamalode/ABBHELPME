import { MemoryRepository } from '@/data/memoryRepository';
import { computeRecap, monthRange } from '@/lib/recap';
import { validatePostInput } from '@/data/shared';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `id-${++n}` };
});

describe('profile', () => {
  it('creates a profile and marks onboarding complete', async () => {
    const repo = new MemoryRepository();
    expect(await repo.getProfile()).toBeNull();
    const p = await repo.createProfile({ displayName: '  Asha ', lockEnabled: true, role: 'intern', experience: 'lt1' });
    expect(p.displayName).toBe('Asha');
    expect(p).toMatchObject({ role: 'intern', experience: 'lt1', verified: true });
    expect(p.onboardingComplete).toBe(false);
    await repo.setOnboardingComplete();
    expect((await repo.getProfile())?.onboardingComplete).toBe(true);
  });
});

describe('content CRUD', () => {
  it('creates, edits and deletes a post', async () => {
    const repo = new MemoryRepository();
    const post = await repo.createPost({ kind: 'personal', category: 'Stress & Anxiety', title: '', body: 'a note' });
    expect(post.mine).toBe(true);
    expect((await repo.listPosts('personal')).some((p) => p.id === post.id)).toBe(true);

    const edited = await repo.updatePost(post.id, { category: 'Stress & Anxiety', title: '', body: 'edited note' });
    expect(edited?.body).toBe('edited note');

    await repo.deletePost(post.id);
    expect(await repo.getPost(post.id)).toBeNull();
  });

  it('removes bookmarks and comments when a post is deleted', async () => {
    const repo = new MemoryRepository();
    const post = await repo.createPost({ kind: 'work_question', category: 'IT', title: 'Q', body: 'question text' });
    await repo.addComment(post.id, 'a comment');
    await repo.toggleBookmark('post', post.id);
    await repo.deletePost(post.id);
    expect(await repo.listComments(post.id)).toHaveLength(0);
    expect(await repo.isBookmarked('post', post.id)).toBe(false);
  });
});

describe('validation', () => {
  it('requires a title and detail for questions, not for personal notes', () => {
    expect(validatePostInput('', '', 'personal')).toBeNull();
    expect(validatePostInput('ab', 'some detail', 'work_question')).not.toBeNull();
    expect(validatePostInput('A title', 'some detail', 'work_question')).toBeNull();
    expect(validatePostInput('', 'x'.repeat(501), 'personal')).not.toBeNull();
  });
});

describe('recap', () => {
  it('counts only this month\'s own records', async () => {
    const repo = new MemoryRepository();
    await repo.createPost({ kind: 'personal', category: 'x', title: '', body: 'note one' });
    await repo.createPost({ kind: 'achievement', category: 'Teamwork', title: 'Shipped', body: 'we shipped it' });
    await repo.toggleBookmark('resource', 'r-stress');
    await repo.addMoodCheckin('okay');
    const now = new Date();
    const recap = computeRecap(
      await repo.listPosts(), await repo.listBookmarks(), await repo.listMoodCheckins(),
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'], now.getFullYear(), now.getMonth(),
    );
    expect(recap).toMatchObject({ entriesWritten: 2, personalEntries: 1, achievements: 1, resourcesSaved: 1, moodCheckins: 1, topicsExplored: 7 });
  });

  it('returns zero for a month with no activity', async () => {
    const repo = new MemoryRepository();
    await repo.createPost({ kind: 'personal', category: 'x', title: '', body: 'note' });
    const [start] = monthRange(2020, 0);
    expect(start).toBe(new Date(2020, 0, 1).getTime());
    const recap = computeRecap(await repo.listPosts(), [], [], [], 2020, 0);
    expect(recap.entriesWritten).toBe(0);
  });
});

describe('delete account', () => {
  it('removes the profile and every record', async () => {
    const repo = new MemoryRepository();
    await repo.createProfile({ displayName: 'Asha', lockEnabled: false, role: null, experience: null });
    await repo.saveSelectedTopicIds(['a', 'b']);
    const post = await repo.createPost({ kind: 'personal', category: 'x', title: '', body: 'note' });
    await repo.setVote('post', 'other-post', 1);
    await repo.toggleBookmark('post', post.id);
    await repo.addMoodCheckin('great');
    await repo.deleteAccount();
    expect(await repo.getProfile()).toBeNull();
    expect(await repo.getSelectedTopicIds()).toEqual([]);
    expect(await repo.listPosts()).toHaveLength(0);
    expect(await repo.listBookmarks()).toHaveLength(0);
    expect(await repo.listMoodCheckins()).toHaveLength(0);
    expect(await repo.listVotes('post', ['other-post'])).toHaveLength(0);
  });
});

describe('author snapshot', () => {
  it('attaches role/experience only when the author opts in, and never a name', async () => {
    const repo = new MemoryRepository();
    await repo.createProfile({ displayName: 'Asha', lockEnabled: false, role: 'engineer', experience: '3to5' });
    const shown = await repo.createPost({ kind: 'work_question', category: 'IT', title: 'Q one', body: 'details here', showAuthor: true });
    const hidden = await repo.createPost({ kind: 'personal', category: 'x', title: '', body: 'note' });
    expect(shown.author).toEqual({ role: 'engineer', experience: '3to5', verified: true });
    expect(JSON.stringify(shown.author)).not.toContain('Asha');
    expect(hidden.author).toBeNull();
  });
});

describe('votes and accepted answers', () => {
  it('adds a vote to the score and can remove it', async () => {
    const repo = new MemoryRepository();
    await repo.setVote('comment', 'c1', 1);
    expect((await repo.getScores('comment', ['c1'])).c1).toBe(1);
    await repo.setVote('comment', 'c1', null);
    expect((await repo.getScores('comment', ['c1'])).c1).toBe(0);
  });

  it('requires a reason for a downvote', async () => {
    const repo = new MemoryRepository();
    await expect(repo.setVote('comment', 'c1', -1)).rejects.toThrow();
    await repo.setVote('comment', 'c1', -1, 'Outdated');
    expect(await repo.getVote('comment', 'c1')).toMatchObject({ value: -1, reason: 'Outdated' });
    await repo.setVote('post', 'p1', -1, 'Off-topic');
    expect((await repo.getScores('post', ['p1'])).p1).toBe(-1);
  });

  it('lets the author accept one answer on their own question only', async () => {
    const repo = new MemoryRepository();
    const q = await repo.createPost({ kind: 'work_question', category: 'IT', title: 'My Q', body: 'details here' });
    const a1 = await repo.addComment(q.id, 'answer one');
    const a2 = await repo.addComment(q.id, 'answer two');
    await repo.acceptAnswer(q.id, a1.id);
    await repo.acceptAnswer(q.id, a2.id);
    const list = await repo.listComments(q.id);
    expect(list.filter((c) => c.accepted).map((c) => c.id)).toEqual([a2.id]);
    await repo.acceptAnswer('someone-elses-post', a1.id);
    expect(await repo.listComments('someone-elses-post')).toEqual([]);
  });

  it('reports score, vote, saved flag and answer count together', async () => {
    const repo = new MemoryRepository();
    const q = await repo.createPost({ kind: 'work_question', category: 'IT', title: 'My Q', body: 'details here' });
    await repo.addComment(q.id, 'answer');
    await repo.toggleBookmark('post', q.id);
    await repo.setVote('post', q.id, 1);
    expect((await repo.getPostMeta([q.id]))[q.id]).toMatchObject({ score: 1, saved: true, comments: 1, solved: false });
  });
});
