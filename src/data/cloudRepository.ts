import type { SupabaseClient } from '@supabase/supabase-js';
import { authorSnapshot } from './shared';
import type { Repository } from './repository';
import type {
  AuthorMeta, Bookmark, BookmarkType, Comment, DownvoteReason, Mood, MoodCheckin, MoodTag, NewPostInput, NewProfileInput,
  NotificationPrefs, Post, PostKind, Profile, ProfilePatch, Resource, Topic, Vote, VoteTarget, VoteValue,
} from './types';

/** Ids of rows stored in Supabase start with this (see supabase/schema.sql). Everything else is local. */
export const CLOUD_ID_PREFIX = 'c-';
export const isCloudId = (id: string) => id.startsWith(CLOUD_ID_PREFIX);

type AuthorCols = { author_role: string | null; author_experience: string | null; show_author: boolean };
const toAuthor = (r: AuthorCols): AuthorMeta | null =>
  r.show_author ? { role: r.author_role, experience: r.author_experience, verified: true } : null;

type PostRow = {
  id: string; user_id: string; kind: PostKind; category: string; title: string; body: string;
  created_at: string; updated_at: string; accepted_comment_id: string | null;
} & AuthorCols;
type CommentRow = { id: string; post_id: string; user_id: string; body: string; created_at: string } & AuthorCols;
type VoteRow = { target_type: VoteTarget; target_id: string; value: number; reason: string | null; created_at: string };

/**
 * Shared community content lives in Supabase; everything private stays in `local`.
 *
 * Cloud: work questions, achievements, their answers, votes and reports.
 * Local: profile, personal notes, mood check-ins, bookmarks, preferences, sample content.
 *
 * Content written by colleagues is returned with `sample: true, shared: true` so the UI treats it as
 * read-only and votable; your own cloud content is `sample: false, shared: true`.
 * Every cloud request carries the signed-in user's JWT; row-level security only lets verified
 * members read the community and change their own rows.
 * Reads fall back to local data when offline or signed out; writes throw so the UI can say they were not saved.
 */
export class CloudRepository implements Repository {
  constructor(private readonly local: Repository, private readonly client: SupabaseClient) {}

  init() { return this.local.init(); }

  private async uid(): Promise<string> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) throw new Error('Not signed in');
    return data.session.user.id;
  }

  private toPost = (r: PostRow, me: string | null): Post => ({
    id: r.id, kind: r.kind, category: r.category, title: r.title, body: r.body,
    createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
    sample: r.user_id !== me, shared: true, author: toAuthor(r),
  });

  private toComment = (r: CommentRow, me: string | null, accepted: string | null): Comment => ({
    id: r.id, postId: r.post_id, body: r.body, createdAt: Date.parse(r.created_at),
    sample: r.user_id !== me, shared: true, author: toAuthor(r), accepted: r.id === accepted,
  });

  // ---- local-only passthrough ------------------------------------------------
  getProfile(): Promise<Profile | null> { return this.local.getProfile(); }
  createProfile(input: NewProfileInput) { return this.local.createProfile(input); }
  updateProfile(patch: ProfilePatch) { return this.local.updateProfile(patch); }
  setOnboardingComplete() { return this.local.setOnboardingComplete(); }
  listTopics(): Promise<Topic[]> { return this.local.listTopics(); }
  getSelectedTopicIds() { return this.local.getSelectedTopicIds(); }
  saveSelectedTopicIds(ids: string[]) { return this.local.saveSelectedTopicIds(ids); }
  listBookmarks(): Promise<Bookmark[]> { return this.local.listBookmarks(); }
  isBookmarked(type: BookmarkType, itemId: string) { return this.local.isBookmarked(type, itemId); }
  toggleBookmark(type: BookmarkType, itemId: string) { return this.local.toggleBookmark(type, itemId); }
  listResources(): Promise<Resource[]> { return this.local.listResources(); }
  getResource(id: string) { return this.local.getResource(id); }
  addMoodCheckin(mood: Mood, tags?: MoodTag[], at?: number): Promise<MoodCheckin> { return this.local.addMoodCheckin(mood, tags, at); }
  listMoodCheckins(): Promise<MoodCheckin[]> { return this.local.listMoodCheckins(); }
  getNotificationPrefs(): Promise<NotificationPrefs> { return this.local.getNotificationPrefs(); }
  setNotificationPrefs(p: NotificationPrefs) { return this.local.setNotificationPrefs(p); }

  // ---- posts -----------------------------------------------------------------
  async listPosts(kind?: PostKind): Promise<Post[]> {
    const local = await this.local.listPosts(kind);
    if (kind === 'personal') return local;
    try {
      const me = await this.uid();
      let q = this.client.from('posts').select('*').order('created_at', { ascending: false }).limit(200);
      if (kind) q = q.eq('kind', kind);
      const { data, error } = await q;
      if (error) throw error;
      const cloud = (data as PostRow[]).map((r) => this.toPost(r, me));
      return [...cloud, ...local].sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return local;
    }
  }

  async getPost(id: string): Promise<Post | null> {
    if (!isCloudId(id)) return this.local.getPost(id);
    try {
      const me = await this.uid();
      const { data, error } = await this.client.from('posts').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? this.toPost(data as PostRow, me) : null;
    } catch {
      return null;
    }
  }

  async createPost(input: NewPostInput): Promise<Post> {
    if (input.kind === 'personal') return this.local.createPost(input);
    const me = await this.uid();
    const author = authorSnapshot(await this.local.getProfile(), input.showAuthor);
    const { data, error } = await this.client.from('posts').insert({
      kind: input.kind, category: input.category, title: input.title.trim(), body: input.body.trim(),
      show_author: !!author, author_role: author?.role ?? null, author_experience: author?.experience ?? null,
    }).select('*').single();
    if (error) throw error;
    return this.toPost(data as PostRow, me);
  }

  async updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>): Promise<Post | null> {
    if (!isCloudId(id)) return this.local.updatePost(id, patch);
    const me = await this.uid();
    const { data, error } = await this.client.from('posts').update({
      category: patch.category, title: patch.title.trim(), body: patch.body.trim(), updated_at: new Date().toISOString(),
    }).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data ? this.toPost(data as PostRow, me) : null;
  }

  async deletePost(id: string): Promise<void> {
    if (isCloudId(id)) {
      const { error } = await this.client.from('posts').delete().eq('id', id);
      if (error) throw error;
    }
    await this.local.deletePost(id); // also clears local bookmarks for it
  }

  // ---- comments --------------------------------------------------------------
  async listComments(postId: string): Promise<Comment[]> {
    if (!isCloudId(postId)) return this.local.listComments(postId);
    try {
      const me = await this.uid();
      const [c, p] = await Promise.all([
        this.client.from('comments').select('*').eq('post_id', postId).order('created_at'),
        this.client.from('posts').select('accepted_comment_id').eq('id', postId).maybeSingle(),
      ]);
      if (c.error) throw c.error;
      const accepted = (p.data as { accepted_comment_id: string | null } | null)?.accepted_comment_id ?? null;
      return (c.data as CommentRow[]).map((r) => this.toComment(r, me, accepted));
    } catch {
      return [];
    }
  }

  async listMyComments(): Promise<Comment[]> {
    const local = await this.local.listMyComments();
    try {
      const me = await this.uid();
      const { data, error } = await this.client.from('comments')
        .select('*, posts(accepted_comment_id)').eq('user_id', me).order('created_at');
      if (error) throw error;
      const cloud = (data as (CommentRow & { posts: { accepted_comment_id: string | null } | null })[])
        .map((r) => this.toComment(r, me, r.posts?.accepted_comment_id ?? null));
      return [...local, ...cloud].sort((a, b) => a.createdAt - b.createdAt);
    } catch {
      return local;
    }
  }

  async addComment(postId: string, body: string, showAuthor?: boolean, at?: number): Promise<Comment> {
    if (!isCloudId(postId)) return this.local.addComment(postId, body, showAuthor, at);
    const me = await this.uid();
    const author = authorSnapshot(await this.local.getProfile(), showAuthor);
    const { data, error } = await this.client.from('comments').insert({
      post_id: postId, body: body.trim(),
      show_author: !!author, author_role: author?.role ?? null, author_experience: author?.experience ?? null,
    }).select('*').single();
    if (error) throw error;
    return this.toComment(data as CommentRow, me, null);
  }

  async acceptAnswer(postId: string, commentId: string | null): Promise<void> {
    if (!isCloudId(postId)) return this.local.acceptAnswer(postId, commentId);
    const { error } = await this.client.from('posts').update({ accepted_comment_id: commentId }).eq('id', postId);
    if (error) throw error;
  }

  // ---- votes -----------------------------------------------------------------
  async getVote(target: VoteTarget, id: string): Promise<Vote | null> {
    if (!isCloudId(id)) return this.local.getVote(target, id);
    try {
      const me = await this.uid();
      const { data, error } = await this.client.from('votes').select('*')
        .eq('user_id', me).eq('target_type', target).eq('target_id', id).maybeSingle();
      if (error) throw error;
      return data ? this.toVote(data as VoteRow) : null;
    } catch {
      return null;
    }
  }

  async setVote(target: VoteTarget, id: string, value: VoteValue | null, reason: DownvoteReason | null = null): Promise<void> {
    if (!isCloudId(id)) return this.local.setVote(target, id, value, reason);
    const me = await this.uid();
    if (value == null) {
      const { error } = await this.client.from('votes').delete()
        .eq('user_id', me).eq('target_type', target).eq('target_id', id);
      if (error) throw error;
      return;
    }
    if (value === -1 && !reason) throw new Error('A downvote needs a reason.');
    const { error } = await this.client.from('votes').upsert(
      { user_id: me, target_type: target, target_id: id, value, reason: value === -1 ? reason : null },
      { onConflict: 'user_id,target_type,target_id' });
    if (error) throw error;
  }

  async getScores(target: VoteTarget, ids: string[]): Promise<Record<string, number>> {
    const cloudIds = ids.filter(isCloudId);
    const out = await this.local.getScores(target, ids.filter((i) => !isCloudId(i)));
    for (const id of cloudIds) out[id] = 0;
    if (!cloudIds.length) return out;
    try {
      const { data, error } = await this.client.rpc('vote_scores', { t: target, ids: cloudIds });
      if (error) throw error;
      for (const r of data as { target_id: string; score: number }[]) out[r.target_id] = r.score;
    } catch { /* offline: show 0 */ }
    return out;
  }

  async listVotes(): Promise<Vote[]> {
    const local = await this.local.listVotes();
    try {
      const me = await this.uid();
      const { data, error } = await this.client.from('votes').select('*').eq('user_id', me);
      if (error) throw error;
      return [...local, ...(data as VoteRow[]).map((r) => this.toVote(r))];
    } catch {
      return local;
    }
  }

  private toVote = (r: VoteRow): Vote => ({
    target: r.target_type, targetId: r.target_id, value: r.value as VoteValue,
    reason: r.reason as DownvoteReason | null, createdAt: Date.parse(r.created_at),
  });

  // ---- reports ---------------------------------------------------------------
  async reportPost(postId: string, reason: string): Promise<void> {
    if (!isCloudId(postId)) return this.local.reportPost(postId, reason);
    const me = await this.uid();
    const { error } = await this.client.from('reports').upsert(
      { user_id: me, post_id: postId, reason }, { onConflict: 'user_id,post_id', ignoreDuplicates: true });
    if (error) throw error;
  }

  async listReportedPostIds(): Promise<string[]> {
    const local = await this.local.listReportedPostIds();
    try {
      const me = await this.uid();
      const { data, error } = await this.client.from('reports').select('post_id').eq('user_id', me);
      if (error) throw error;
      return [...local, ...(data as { post_id: string }[]).map((r) => r.post_id)];
    } catch {
      return local;
    }
  }

  // ---- erase -----------------------------------------------------------------
  /** Deletes the signed-in account (and its shared content), then this device's data. */
  async deleteAllLocalData(): Promise<void> {
    // Remove the account first; if that fails (e.g. offline) keep local data so the user can retry.
    const { data } = await this.client.auth.getSession();
    if (data.session) {
      const { error } = await this.client.rpc('delete_my_data');
      if (error) throw error;
      await this.client.auth.signOut({ scope: 'local' });
    }
    await this.local.deleteAllLocalData();
  }
}
