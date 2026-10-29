import type { SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/lib/id';
import { TOPIC_CATALOGUE } from '@/lib/topics';
import { destroyDatabaseAndKey, openEncryptedDb } from './db';
import { migrate } from './schema';
import { DEFAULT_NOTIFICATION_PREFS, authorSnapshot, mergeComments, mergePosts, resolveResources, sampleScoreBase } from './shared';
import type { Repository } from './repository';
import {
  MOOD_TAGS, type AuthorMeta, type Bookmark, type BookmarkType, type Comment, type DownvoteReason, type Mood, type MoodCheckin,
  type MoodTag, type NewPostInput, type NewProfileInput, type NotificationPrefs, type Post, type PostKind, type Profile, type ProfilePatch, type Topic,
  type Vote, type VoteTarget, type VoteValue,
} from './types';

type AuthorCols = { author_role: string | null; author_experience: string | null; show_author: number };
const toAuthor = (r: AuthorCols): AuthorMeta | null =>
  r.show_author ? { role: r.author_role, experience: r.author_experience, verified: true } : null;

type PostRow = { id: string; kind: PostKind; category: string; title: string; body: string; created_at: number; updated_at: number } & AuthorCols;
const toPost = (r: PostRow): Post => ({
  id: r.id, kind: r.kind, category: r.category, title: r.title, body: r.body,
  createdAt: r.created_at, updatedAt: r.updated_at, sample: false, author: toAuthor(r),
});

type CommentRow = { id: string; post_id: string; body: string; created_at: number } & AuthorCols;
const toComment = (r: CommentRow, acceptedId: string | null | undefined): Comment => ({
  id: r.id, postId: r.post_id, body: r.body, createdAt: r.created_at, sample: false, author: toAuthor(r), accepted: r.id === acceptedId,
});

type ProfileRow = {
  id: string; display_name: string; lock_enabled: number; onboarding_complete: number; created_at: number;
  role: string | null; experience: string | null; verified: number;
};

type VoteRow = { target_type: VoteTarget; target_id: string; value: number; reason: string | null; created_at: number };
const toVote = (r: VoteRow): Vote => ({
  target: r.target_type, targetId: r.target_id, value: r.value as VoteValue, reason: r.reason as DownvoteReason | null, createdAt: r.created_at,
});

const parseTags = (s: string): MoodTag[] => s.split(',').filter((t): t is MoodTag => (MOOD_TAGS as readonly string[]).includes(t));

/** Encrypted on-device storage (SQLCipher). All statements use bound parameters. */
export class SqliteRepository implements Repository {
  private db: SQLiteDatabase | null = null;

  private async conn(): Promise<SQLiteDatabase> {
    if (!this.db) await this.init();
    return this.db as SQLiteDatabase;
  }

  async init() {
    if (this.db) return;
    const db = await openEncryptedDb();
    await migrate(db);
    this.db = db;
  }

  async getProfile(): Promise<Profile | null> {
    const db = await this.conn();
    const r = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile LIMIT 1');
    return r ? {
      id: r.id, displayName: r.display_name, lockEnabled: !!r.lock_enabled, onboardingComplete: !!r.onboarding_complete,
      createdAt: r.created_at, role: r.role, experience: r.experience, verified: !!r.verified,
    } : null;
  }
  async createProfile(input: NewProfileInput): Promise<Profile> {
    const db = await this.conn();
    const p: Profile = {
      id: newId(), displayName: input.displayName.trim(), lockEnabled: input.lockEnabled, onboardingComplete: false,
      createdAt: Date.now(), role: input.role, experience: input.experience, verified: true,
    };
    await db.runAsync('DELETE FROM profile');
    await db.runAsync(
      'INSERT INTO profile (id, display_name, lock_enabled, onboarding_complete, created_at, role, experience, verified) VALUES (?,?,?,?,?,?,?,?)',
      p.id, p.displayName, p.lockEnabled ? 1 : 0, 0, p.createdAt, p.role, p.experience, 1);
    return p;
  }
  async updateProfile(patch: ProfilePatch) {
    const cur = await this.getProfile();
    if (!cur) return null;
    const next = { ...cur, ...patch, displayName: (patch.displayName ?? cur.displayName).trim() };
    const db = await this.conn();
    await db.runAsync('UPDATE profile SET display_name = ?, role = ?, experience = ?, lock_enabled = ? WHERE id = ?',
      next.displayName, next.role, next.experience, next.lockEnabled ? 1 : 0, cur.id);
    return next;
  }
  async setOnboardingComplete() {
    const db = await this.conn();
    await db.runAsync('UPDATE profile SET onboarding_complete = 1');
  }

  async listTopics(): Promise<Topic[]> { return TOPIC_CATALOGUE.map((t) => ({ ...t })); }
  async getSelectedTopicIds() {
    const db = await this.conn();
    return (await db.getAllAsync<{ topic_id: string }>('SELECT topic_id FROM topic_preferences')).map((r) => r.topic_id);
  }
  async saveSelectedTopicIds(ids: string[]) {
    const db = await this.conn();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM topic_preferences');
      for (const id of ids) await tx.runAsync('INSERT INTO topic_preferences (topic_id) VALUES (?)', id);
    });
  }

  async listPosts(kind?: PostKind) {
    const db = await this.conn();
    const rows = await db.getAllAsync<PostRow>('SELECT * FROM posts ORDER BY created_at DESC');
    return mergePosts(rows.map(toPost), kind);
  }
  async getPost(id: string) {
    const db = await this.conn();
    const r = await db.getFirstAsync<PostRow>('SELECT * FROM posts WHERE id = ?', id);
    if (r) return toPost(r);
    return mergePosts([]).find((p) => p.id === id) ?? null;
  }
  async createPost(input: NewPostInput): Promise<Post> {
    const db = await this.conn();
    const now = input.createdAt ?? Date.now();
    const { showAuthor, createdAt: _at, ...rest } = input;
    const author = authorSnapshot(await this.getProfile(), showAuthor);
    const post: Post = { id: newId(), ...rest, title: input.title.trim(), body: input.body.trim(), createdAt: now, updatedAt: now, sample: false, author };
    await db.runAsync(
      'INSERT INTO posts (id, kind, category, title, body, created_at, updated_at, author_role, author_experience, show_author) VALUES (?,?,?,?,?,?,?,?,?,?)',
      post.id, post.kind, post.category, post.title, post.body, now, now, author?.role ?? null, author?.experience ?? null, author ? 1 : 0);
    return post;
  }
  async updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>) {
    const db = await this.conn();
    const now = Date.now();
    const res = await db.runAsync('UPDATE posts SET category = ?, title = ?, body = ?, updated_at = ? WHERE id = ?',
      patch.category, patch.title.trim(), patch.body.trim(), now, id);
    if (!res.changes) return null;
    return this.getPost(id);
  }
  async deletePost(id: string) {
    const db = await this.conn();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("DELETE FROM votes WHERE target_type = 'comment' AND target_id IN (SELECT id FROM comments WHERE post_id = ?)", id);
      await tx.runAsync('DELETE FROM comments WHERE post_id = ?', id);
      await tx.runAsync('DELETE FROM accepted_answers WHERE post_id = ?', id);
      await tx.runAsync("DELETE FROM votes WHERE target_type = 'post' AND target_id = ?", id);
      await tx.runAsync('DELETE FROM reactions WHERE post_id = ?', id);
      await tx.runAsync("DELETE FROM bookmarks WHERE type = 'post' AND item_id = ?", id);
      await tx.runAsync('DELETE FROM reports WHERE post_id = ?', id);
      await tx.runAsync('DELETE FROM posts WHERE id = ?', id);
    });
  }

  private async acceptedFor(postId: string) {
    const db = await this.conn();
    return (await db.getFirstAsync<{ comment_id: string }>('SELECT comment_id FROM accepted_answers WHERE post_id = ?', postId))?.comment_id ?? null;
  }
  async listComments(postId: string) {
    const db = await this.conn();
    const rows = await db.getAllAsync<CommentRow>('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at', postId);
    const acc = await this.acceptedFor(postId);
    return mergeComments(rows.map((r) => toComment(r, acc)), postId, acc);
  }
  async listMyComments() {
    const db = await this.conn();
    const rows = await db.getAllAsync<CommentRow & { accepted_id: string | null }>(
      'SELECT c.*, a.comment_id AS accepted_id FROM comments c LEFT JOIN accepted_answers a ON a.post_id = c.post_id ORDER BY c.created_at');
    return rows.map((r) => toComment(r, r.accepted_id));
  }
  async addComment(postId: string, body: string, showAuthor?: boolean, at?: number): Promise<Comment> {
    const db = await this.conn();
    const author = authorSnapshot(await this.getProfile(), showAuthor);
    const c: Comment = { id: newId(), postId, body: body.trim(), createdAt: at ?? Date.now(), sample: false, accepted: false, author };
    await db.runAsync(
      'INSERT INTO comments (id, post_id, body, created_at, author_role, author_experience, show_author) VALUES (?,?,?,?,?,?,?)',
      c.id, c.postId, c.body, c.createdAt, author?.role ?? null, author?.experience ?? null, author ? 1 : 0);
    return c;
  }
  async acceptAnswer(postId: string, commentId: string | null) {
    const db = await this.conn();
    if (!(await db.getFirstAsync('SELECT 1 AS x FROM posts WHERE id = ?', postId))) return; // only local questions
    if (!commentId) { await db.runAsync('DELETE FROM accepted_answers WHERE post_id = ?', postId); return; }
    await db.runAsync('INSERT OR REPLACE INTO accepted_answers (post_id, comment_id, created_at) VALUES (?,?,?)', postId, commentId, Date.now());
  }

  async getVote(target: VoteTarget, id: string): Promise<Vote | null> {
    const db = await this.conn();
    const r = await db.getFirstAsync<VoteRow>('SELECT * FROM votes WHERE target_type = ? AND target_id = ?', target, id);
    return r ? toVote(r) : null;
  }
  async setVote(target: VoteTarget, id: string, value: VoteValue | null, reason: DownvoteReason | null = null) {
    const db = await this.conn();
    if (value == null) { await db.runAsync('DELETE FROM votes WHERE target_type = ? AND target_id = ?', target, id); return; }
    if (value === -1 && !reason) throw new Error('A downvote needs a reason.');
    await db.runAsync('INSERT OR REPLACE INTO votes (target_type, target_id, value, reason, created_at) VALUES (?,?,?,?,?)',
      target, id, value, value === -1 ? reason : null, Date.now());
  }
  async getScores(target: VoteTarget, ids: string[]) {
    const db = await this.conn();
    const rows = await db.getAllAsync<{ target_id: string; value: number }>('SELECT target_id, value FROM votes WHERE target_type = ?', target);
    const mine = new Map(rows.map((r) => [r.target_id, r.value]));
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = sampleScoreBase(target, id) + (mine.get(id) ?? 0);
    return out;
  }
  async listVotes(): Promise<Vote[]> {
    const db = await this.conn();
    return (await db.getAllAsync<VoteRow>('SELECT * FROM votes')).map(toVote);
  }

  async listBookmarks(): Promise<Bookmark[]> {
    const db = await this.conn();
    const rows = await db.getAllAsync<{ type: BookmarkType; item_id: string; created_at: number }>('SELECT * FROM bookmarks ORDER BY created_at DESC');
    return rows.map((r) => ({ type: r.type, itemId: r.item_id, createdAt: r.created_at }));
  }
  async isBookmarked(type: BookmarkType, itemId: string) {
    const db = await this.conn();
    return !!(await db.getFirstAsync('SELECT 1 AS x FROM bookmarks WHERE type = ? AND item_id = ?', type, itemId));
  }
  async toggleBookmark(type: BookmarkType, itemId: string) {
    const db = await this.conn();
    if (await this.isBookmarked(type, itemId)) {
      await db.runAsync('DELETE FROM bookmarks WHERE type = ? AND item_id = ?', type, itemId); return false;
    }
    await db.runAsync('INSERT INTO bookmarks (type, item_id, created_at) VALUES (?,?,?)', type, itemId, Date.now());
    return true;
  }

  async reportPost(postId: string, reason: string) {
    const db = await this.conn();
    await db.runAsync('INSERT INTO reports (id, post_id, reason, created_at) VALUES (?,?,?,?)', newId(), postId, reason, Date.now());
  }
  async listReportedPostIds() {
    const db = await this.conn();
    return (await db.getAllAsync<{ post_id: string }>('SELECT post_id FROM reports')).map((r) => r.post_id);
  }

  async listResources() { return resolveResources(); }
  async getResource(id: string) { return resolveResources().find((r) => r.id === id) ?? null; }

  async addMoodCheckin(mood: Mood, tags: MoodTag[] = [], at?: number): Promise<MoodCheckin> {
    const db = await this.conn();
    const m: MoodCheckin = { id: newId(), mood, tags: [...tags], createdAt: at ?? Date.now() };
    await db.runAsync('INSERT INTO mood_checkins (id, mood, created_at, tags) VALUES (?,?,?,?)', m.id, m.mood, m.createdAt, m.tags.join(','));
    return m;
  }
  async listMoodCheckins(): Promise<MoodCheckin[]> {
    const db = await this.conn();
    const rows = await db.getAllAsync<{ id: string; mood: Mood; created_at: number; tags: string | null }>(
      'SELECT * FROM mood_checkins ORDER BY created_at DESC');
    return rows.map((r) => ({ id: r.id, mood: r.mood, tags: parseTags(r.tags ?? ''), createdAt: r.created_at }));
  }

  async getNotificationPrefs(): Promise<NotificationPrefs> {
    const db = await this.conn();
    const r = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'notification_prefs'");
    if (!r) return { ...DEFAULT_NOTIFICATION_PREFS };
    try { return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(r.value) }; } catch { return { ...DEFAULT_NOTIFICATION_PREFS }; }
  }
  async setNotificationPrefs(p: NotificationPrefs) {
    const db = await this.conn();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('notification_prefs', ?)", JSON.stringify(p));
  }

  async deleteAllLocalData() {
    await destroyDatabaseAndKey(this.db);
    this.db = null;
  }
}
