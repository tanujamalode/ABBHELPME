import { newId } from '@/lib/id';
import { DEFAULT_NOTIFICATION_PREFS, authorSnapshot, mergeComments, mergePosts, resolveResources, sampleScoreBase } from './shared';
import { TOPIC_CATALOGUE } from '@/lib/topics';
import type { Repository } from './repository';
import type {
  Bookmark, BookmarkType, Comment, DownvoteReason, Mood, MoodCheckin, MoodTag, NewPostInput, NewProfileInput,
  NotificationPrefs, Post, PostKind, Profile, ProfilePatch, Topic, Vote, VoteTarget, VoteValue,
} from './types';

/** In-memory implementation: used by unit tests and as a reference for the interface. */
export class MemoryRepository implements Repository {
  private profile: Profile | null = null;
  private topics: string[] = [];
  private posts: Post[] = [];
  private comments: Comment[] = [];
  private accepted = new Map<string, string>();
  private votes = new Map<string, Vote>();
  private bookmarks: Bookmark[] = [];
  private reports: { postId: string; reason: string }[] = [];
  private moods: MoodCheckin[] = [];
  private prefs: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };

  async init() {}

  async getProfile() { return this.profile; }
  async createProfile(input: NewProfileInput): Promise<Profile> {
    this.profile = {
      id: newId(), displayName: input.displayName.trim(), lockEnabled: input.lockEnabled, onboardingComplete: false,
      createdAt: Date.now(), role: input.role, experience: input.experience, verified: true,
    };
    return this.profile;
  }
  async updateProfile(patch: ProfilePatch) {
    if (!this.profile) return null;
    this.profile = { ...this.profile, ...patch };
    return this.profile;
  }
  async setOnboardingComplete() { if (this.profile) this.profile = { ...this.profile, onboardingComplete: true }; }

  async listTopics(): Promise<Topic[]> { return TOPIC_CATALOGUE.map((t) => ({ ...t })); }
  async getSelectedTopicIds() { return [...this.topics]; }
  async saveSelectedTopicIds(ids: string[]) { this.topics = [...ids]; }

  async listPosts(kind?: PostKind) { return mergePosts(this.posts, kind); }
  async getPost(id: string) { return mergePosts(this.posts).find((p) => p.id === id) ?? null; }
  async createPost(input: NewPostInput): Promise<Post> {
    const now = input.createdAt ?? Date.now();
    const { showAuthor, createdAt: _at, ...rest } = input;
    const post: Post = {
      id: newId(), ...rest, title: input.title.trim(), body: input.body.trim(), createdAt: now, updatedAt: now, sample: false,
      author: authorSnapshot(this.profile, showAuthor),
    };
    this.posts.unshift(post);
    return post;
  }
  async updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>) {
    const i = this.posts.findIndex((p) => p.id === id);
    if (i < 0) return null;
    this.posts[i] = { ...this.posts[i], ...patch, updatedAt: Date.now() };
    return this.posts[i];
  }
  async deletePost(id: string) {
    const commentIds = new Set(this.comments.filter((c) => c.postId === id).map((c) => c.id));
    this.posts = this.posts.filter((p) => p.id !== id);
    this.comments = this.comments.filter((c) => c.postId !== id);
    this.accepted.delete(id);
    this.votes.delete(`post:${id}`);
    for (const cid of commentIds) this.votes.delete(`comment:${cid}`);
    this.bookmarks = this.bookmarks.filter((b) => !(b.type === 'post' && b.itemId === id));
  }

  async listComments(postId: string) {
    return mergeComments(this.comments.filter((c) => c.postId === postId), postId, this.accepted.get(postId));
  }
  async listMyComments() { return this.comments.map((c) => ({ ...c, accepted: this.accepted.get(c.postId) === c.id })); }
  async addComment(postId: string, body: string, showAuthor?: boolean, at?: number): Promise<Comment> {
    const c: Comment = {
      id: newId(), postId, body: body.trim(), createdAt: at ?? Date.now(), sample: false, accepted: false,
      author: authorSnapshot(this.profile, showAuthor),
    };
    this.comments.push(c);
    return c;
  }
  async acceptAnswer(postId: string, commentId: string | null) {
    if (!this.posts.some((p) => p.id === postId)) return; // only the author's own (local) questions
    if (commentId) this.accepted.set(postId, commentId); else this.accepted.delete(postId);
  }

  async getVote(target: VoteTarget, id: string) { return this.votes.get(`${target}:${id}`) ?? null; }
  async setVote(target: VoteTarget, id: string, value: VoteValue | null, reason: DownvoteReason | null = null) {
    const key = `${target}:${id}`;
    if (value == null) { this.votes.delete(key); return; }
    if (value === -1 && !reason) throw new Error('A downvote needs a reason.');
    this.votes.set(key, { target, targetId: id, value, reason: value === -1 ? reason : null, createdAt: Date.now() });
  }
  async getScores(target: VoteTarget, ids: string[]) {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = sampleScoreBase(target, id) + (this.votes.get(`${target}:${id}`)?.value ?? 0);
    return out;
  }
  async listVotes() { return [...this.votes.values()]; }

  async listBookmarks() { return [...this.bookmarks]; }
  async isBookmarked(type: BookmarkType, itemId: string) { return this.bookmarks.some((b) => b.type === type && b.itemId === itemId); }
  async toggleBookmark(type: BookmarkType, itemId: string) {
    const i = this.bookmarks.findIndex((b) => b.type === type && b.itemId === itemId);
    if (i >= 0) { this.bookmarks.splice(i, 1); return false; }
    this.bookmarks.push({ type, itemId, createdAt: Date.now() }); return true;
  }

  async reportPost(postId: string, reason: string) { this.reports.push({ postId, reason }); }
  async listReportedPostIds() { return this.reports.map((r) => r.postId); }

  async listResources() { return resolveResources(); }
  async getResource(id: string) { return resolveResources().find((r) => r.id === id) ?? null; }

  async addMoodCheckin(mood: Mood, tags: MoodTag[] = [], at?: number): Promise<MoodCheckin> {
    const m = { id: newId(), mood, tags: [...tags], createdAt: at ?? Date.now() };
    this.moods.push(m); return m;
  }
  async listMoodCheckins() { return [...this.moods].sort((a, b) => b.createdAt - a.createdAt); }

  async getNotificationPrefs() { return { ...this.prefs }; }
  async setNotificationPrefs(p: NotificationPrefs) { this.prefs = { ...p }; }

  async deleteAllLocalData() {
    this.profile = null; this.topics = []; this.posts = []; this.comments = [];
    this.accepted.clear(); this.votes.clear(); this.bookmarks = []; this.reports = []; this.moods = [];
    this.prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  }
}
