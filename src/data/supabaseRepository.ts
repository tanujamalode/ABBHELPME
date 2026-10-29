import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import * as ImageManipulator from 'expo-image-manipulator';
import { newId } from '@/lib/id';
import { TOPIC_CATALOGUE } from '@/lib/topics';
import { authorSnapshot } from './shared';
import type { Repository } from './repository';
import type {
  AppNotification, AuthorMeta, Bookmark, BookmarkType, ChatFlag, ChatMessage, Comment, Community, CommunityStat, Conversation,
  ConversationStatus, DownvoteReason, FeedbackCategory, FeedbackRow, Mood, MoodCheckin, MoodTag, NewPostInput, NewProfileInput,
  NotificationKind, NotificationPrefs, OrgPulse, PersonMatch, PollState, Post, PostKind, PostMeta, Profile, ProfilePatch,
  ReceivedFeedback, ReceivedShoutout, Resource, ResourceGroup, ShoutoutBadge, Topic, Vote, VoteTarget, VoteValue, WallShoutout,
  WellnessKind, WellnessSession,
} from './types';

/**
 * Everything the app stores lives in Supabase (schema: supabase/setup.sql).
 *
 * Reads of other people's posts and answers go through the `posts_feed` / `comments_feed` views, which
 * never include user_id. Writes go to the base tables, where row-level security only lets a member
 * change their own rows. Every request carries the signed-in user's JWT.
 */

type AuthorCols = { show_author: boolean; author_role: string | null; author_experience: string | null };
type PostRow = {
  id: string; kind: PostKind; category: string; title: string; body: string; accepted_comment_id: string | null;
  created_at: string; updated_at: string; mine?: boolean;
  community_id?: string | null; attachments?: string[]; is_leader?: boolean;
} & AuthorCols;
type CommentRow = { id: string; post_id: string; body: string; created_at: string; mine?: boolean } & AuthorCols;
type VoteRow = { target_type: VoteTarget; target_id: string; value: number; reason: string | null; created_at: string };
type ProfileRow = {
  id: string; display_name: string; role: string | null; experience: string | null; lock_enabled: boolean;
  onboarding_complete: boolean; topics: string[]; daily_reminder: boolean; resource_tips: boolean; created_at: string;
  reminder_hydration: boolean; reminder_break: boolean; discoverable: boolean;
};
type MoodRow = { id: string; mood: Mood; tags: MoodTag[]; created_at: string };
type BookmarkRow = { type: BookmarkType; item_id: string; created_at: string };
type ResourceRow = {
  id: string; grp: ResourceGroup; title: string; subtitle: string; body: string;
  url: string | null; phone: string | null; email: string | null; verified: boolean;
  source: 'ABB' | 'External'; reviewed_at: string | null;
};
type NotificationRow = {
  id: string; kind: NotificationKind; title: string; body: string; post_id: string | null; read: boolean; created_at: string;
};

const toAuthor = (r: AuthorCols): AuthorMeta | null =>
  r.show_author ? { role: r.author_role, experience: r.author_experience, verified: true } : null;

const toPost = (r: PostRow, mine = r.mine ?? false): Post => ({
  id: r.id, kind: r.kind, category: r.category, title: r.title, body: r.body,
  createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at), mine, author: toAuthor(r),
  communityId: r.community_id ?? null, attachments: r.attachments ?? [], isLeader: !!r.is_leader,
});

const toComment = (r: CommentRow, accepted: string | null, mine = r.mine ?? false): Comment => ({
  id: r.id, postId: r.post_id, body: r.body, createdAt: Date.parse(r.created_at), mine, author: toAuthor(r), accepted: r.id === accepted,
});

const toVote = (r: VoteRow): Vote => ({
  target: r.target_type, targetId: r.target_id, value: r.value as VoteValue,
  reason: r.reason as DownvoteReason | null, createdAt: Date.parse(r.created_at),
});

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id, displayName: r.display_name, lockEnabled: r.lock_enabled, onboardingComplete: r.onboarding_complete,
  createdAt: Date.parse(r.created_at), role: r.role, experience: r.experience, verified: true, discoverable: !!r.discoverable,
});

const toResource = (r: ResourceRow): Resource => ({
  id: r.id, group: r.grp, title: r.title, subtitle: r.subtitle, body: r.body,
  url: r.url ?? undefined, phone: r.phone ?? undefined, email: r.email ?? undefined, verified: r.verified,
  source: r.source, reviewedAt: r.reviewed_at,
});

const IMAGE_BUCKET = 'post-images';
const MAX_IMAGE_WIDTH = 1280;

/** Throws the Supabase error so callers can tell the user nothing was saved. */
function ok<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const BOOKMARK_LIMIT = 500;

/** "there" is the placeholder name for people who never set one. */
const cleanName = (n: string | null) => (n && n !== 'there' ? n : null);

export class SupabaseRepository implements Repository {
  constructor(private readonly client: SupabaseClient) {}

  async init() {}

  private async uid(): Promise<string> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) throw new Error('Not signed in');
    return data.session.user.id;
  }

  // ---- profile ---------------------------------------------------------------
  private async profileRow(): Promise<ProfileRow | null> {
    const me = await this.uid();
    return ok(await this.client.from('profiles').select('*').eq('id', me).maybeSingle()) as ProfileRow | null;
  }

  async getProfile(): Promise<Profile | null> {
    const r = await this.profileRow();
    return r ? toProfile(r) : null;
  }

  async createProfile(input: NewProfileInput): Promise<Profile> {
    const me = await this.uid();
    const row = ok(await this.client.from('profiles').upsert({
      id: me, display_name: input.displayName.trim() || 'there', role: input.role, experience: input.experience,
      lock_enabled: input.lockEnabled,
    }, { onConflict: 'id' }).select('*').single());
    return toProfile(row as ProfileRow);
  }

  async updateProfile(patch: ProfilePatch): Promise<Profile | null> {
    const me = await this.uid();
    const cols: Record<string, unknown> = {};
    if (patch.displayName !== undefined) cols.display_name = patch.displayName.trim() || 'there';
    if (patch.role !== undefined) cols.role = patch.role;
    if (patch.experience !== undefined) cols.experience = patch.experience;
    if (patch.lockEnabled !== undefined) cols.lock_enabled = patch.lockEnabled;
    if (patch.discoverable !== undefined) cols.discoverable = patch.discoverable;
    if (!Object.keys(cols).length) return this.getProfile();
    const row = ok(await this.client.from('profiles').update(cols).eq('id', me).select('*').maybeSingle());
    return row ? toProfile(row as ProfileRow) : null;
  }

  async setOnboardingComplete() {
    const me = await this.uid();
    ok(await this.client.from('profiles').update({ onboarding_complete: true }).eq('id', me));
  }

  async listTopics(): Promise<Topic[]> { return TOPIC_CATALOGUE.map((t) => ({ ...t })); }

  async getSelectedTopicIds(): Promise<string[]> {
    const known = new Set<string>(TOPIC_CATALOGUE.map((t) => t.id));
    return ((await this.profileRow())?.topics ?? []).filter((t) => known.has(t));
  }

  async saveSelectedTopicIds(ids: string[]) {
    const me = await this.uid();
    const known = new Set<string>(TOPIC_CATALOGUE.map((t) => t.id));
    ok(await this.client.from('profiles').update({ topics: ids.filter((i) => known.has(i)) }).eq('id', me));
  }

  async getNotificationPrefs(): Promise<NotificationPrefs> {
    const r = await this.profileRow();
    return {
      dailyReminder: !!r?.daily_reminder, resourceTips: !!r?.resource_tips,
      hydration: !!r?.reminder_hydration, microBreak: !!r?.reminder_break,
    };
  }

  async setNotificationPrefs(p: NotificationPrefs) {
    const me = await this.uid();
    ok(await this.client.from('profiles').update({
      daily_reminder: p.dailyReminder, resource_tips: p.resourceTips, reminder_hydration: p.hydration, reminder_break: p.microBreak,
    }).eq('id', me));
  }

  // ---- posts -----------------------------------------------------------------
  async listPosts(kind?: PostKind, communityId?: string): Promise<Post[]> {
    let q = this.client.from('posts_feed').select('*').order('created_at', { ascending: false }).limit(200);
    if (kind) q = q.eq('kind', kind);
    if (communityId) q = q.eq('community_id', communityId);
    return (ok(await q) as PostRow[]).map((r) => toPost(r));
  }

  async getPost(id: string): Promise<Post | null> {
    const r = ok(await this.client.from('posts_feed').select('*').eq('id', id).maybeSingle()) as PostRow | null;
    return r ? toPost(r) : null;
  }

  async createPost(input: NewPostInput): Promise<Post> {
    const author = authorSnapshot(await this.getProfile(), input.showAuthor);
    const attachments = (input.attachments ?? []).slice(0, 4);
    if (input.kind === 'poll') {
      const id = ok(await this.client.rpc('create_poll', {
        p_category: input.category, p_title: input.title, p_body: input.body, p_options: input.pollOptions ?? [],
        p_show: !!author, p_role: author?.role ?? null, p_experience: author?.experience ?? null,
        p_community: input.communityId ?? null, p_attachments: attachments,
      })) as string;
      const created = await this.getPost(id);
      if (!created) throw new Error('Poll was not created');
      return created;
    }
    const row = ok(await this.client.from('posts').insert({
      kind: input.kind, category: input.category, title: input.title.trim(), body: input.body.trim(),
      show_author: !!author, author_role: author?.role ?? null, author_experience: author?.experience ?? null,
      community_id: input.communityId ?? null, attachments,
    }).select('*').single());
    return toPost(row as PostRow, true);
  }

  async updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>): Promise<Post | null> {
    const row = ok(await this.client.from('posts').update({
      category: patch.category, title: patch.title.trim(), body: patch.body.trim(),
    }).eq('id', id).select('*').maybeSingle());
    return row ? toPost(row as PostRow, true) : null;
  }

  async deletePost(id: string) {
    // Photos are separate files; remember which ones belong to the post so they can be removed with it.
    const row = ok(await this.client.from('posts').select('attachments').eq('id', id).maybeSingle()) as { attachments: string[] } | null;
    ok(await this.client.from('posts').delete().eq('id', id));
    if (row?.attachments?.length) await this.client.storage.from(IMAGE_BUCKET).remove(row.attachments).catch(() => { /* orphaned file: harmless, private */ });
  }

  async uploadImage(localUri: string): Promise<string> {
    const me = await this.uid();
    // Resize and re-encode on the phone: smaller upload, and the metadata (location, device) is dropped.
    const shrunk = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: MAX_IMAGE_WIDTH } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    const bytes = await (await fetch(shrunk.uri)).arrayBuffer();
    const path = `${me}/${newId()}.jpg`;
    const { error } = await this.client.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return path;
  }

  async getImageUrls(paths: string[]): Promise<Record<string, string>> {
    if (!paths.length) return {};
    const { data, error } = await this.client.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
    if (error) throw new Error(error.message);
    const out: Record<string, string> = {};
    for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
    return out;
  }

  // ---- polls -----------------------------------------------------------------
  async getPoll(postId: string): Promise<PollState> {
    const rows = ok(await this.client.rpc('poll_results', { p_post: postId })) as
      { option_id: string; label: string; votes: number; mine: boolean; revealed: boolean }[];
    return {
      options: rows.map((r) => ({ id: r.option_id, label: r.label, votes: r.votes, mine: r.mine })),
      revealed: rows[0]?.revealed ?? false,
      total: rows.reduce((n, r) => n + r.votes, 0),
    };
  }

  async votePoll(postId: string, optionId: string) {
    const me = await this.uid();
    ok(await this.client.from('poll_votes').upsert({ user_id: me, post_id: postId, option_id: optionId }, { onConflict: 'user_id,post_id' }));
  }

  // ---- communities -----------------------------------------------------------
  async listCommunities(): Promise<Community[]> {
    const rows = ok(await this.client.rpc('community_overview')) as
      { id: string; name: string; description: string; icon: string; accent: string; members: number; posts_7d: number; following: boolean }[];
    return rows.map((r) => ({
      id: r.id, name: r.name, description: r.description, icon: r.icon, accent: r.accent,
      members: r.members, postsThisWeek: r.posts_7d, following: r.following,
    }));
  }

  async setFollowing(communityId: string, follow: boolean) {
    const me = await this.uid();
    if (follow) {
      ok(await this.client.from('community_members').upsert({ user_id: me, community_id: communityId }, { onConflict: 'user_id,community_id' }));
    } else {
      ok(await this.client.from('community_members').delete().eq('user_id', me).eq('community_id', communityId));
    }
  }

  // ---- comments --------------------------------------------------------------
  async listComments(postId: string): Promise<Comment[]> {
    const [c, p] = await Promise.all([
      this.client.from('comments_feed').select('*').eq('post_id', postId).order('created_at'),
      this.client.from('posts_feed').select('accepted_comment_id').eq('id', postId).maybeSingle(),
    ]);
    const accepted = (ok(p) as { accepted_comment_id: string | null } | null)?.accepted_comment_id ?? null;
    return (ok(c) as CommentRow[]).map((r) => toComment(r, accepted));
  }

  async listMyComments(): Promise<Comment[]> {
    const rows = ok(await this.client.from('comments_feed').select('*').eq('mine', true).order('created_at')) as CommentRow[];
    if (!rows.length) return [];
    const postIds = [...new Set(rows.map((r) => r.post_id))];
    const posts = ok(await this.client.from('posts_feed').select('id, accepted_comment_id').in('id', postIds)) as
      { id: string; accepted_comment_id: string | null }[];
    const accepted = new Map(posts.map((p) => [p.id, p.accepted_comment_id]));
    return rows.map((r) => toComment(r, accepted.get(r.post_id) ?? null));
  }

  async addComment(postId: string, body: string, showAuthor?: boolean): Promise<Comment> {
    const author = authorSnapshot(await this.getProfile(), showAuthor);
    const row = ok(await this.client.from('comments').insert({
      post_id: postId, body: body.trim(),
      show_author: !!author, author_role: author?.role ?? null, author_experience: author?.experience ?? null,
    }).select('*').single());
    return toComment(row as CommentRow, null, true);
  }

  async acceptAnswer(postId: string, commentId: string | null) {
    ok(await this.client.from('posts').update({ accepted_comment_id: commentId }).eq('id', postId));
  }

  // ---- votes -----------------------------------------------------------------
  async getVote(target: VoteTarget, id: string): Promise<Vote | null> {
    const me = await this.uid();
    const r = ok(await this.client.from('votes').select('*')
      .eq('user_id', me).eq('target_type', target).eq('target_id', id).maybeSingle()) as VoteRow | null;
    return r ? toVote(r) : null;
  }

  async setVote(target: VoteTarget, id: string, value: VoteValue | null, reason: DownvoteReason | null = null) {
    const me = await this.uid();
    if (value == null) {
      ok(await this.client.from('votes').delete().eq('user_id', me).eq('target_type', target).eq('target_id', id));
      return;
    }
    if (value === -1 && !reason) throw new Error('A downvote needs a reason.');
    ok(await this.client.from('votes').upsert(
      { user_id: me, target_type: target, target_id: id, value, reason: value === -1 ? reason : null },
      { onConflict: 'user_id,target_type,target_id' }));
  }

  async getScores(target: VoteTarget, ids: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
    if (!ids.length) return out;
    for (const r of ok(await this.client.rpc('vote_scores', { t: target, ids })) as { target_id: string; score: number }[]) {
      out[r.target_id] = r.score;
    }
    return out;
  }

  async listVotes(target: VoteTarget, ids: string[]): Promise<Vote[]> {
    if (!ids.length) return [];
    const me = await this.uid();
    const rows = ok(await this.client.from('votes').select('*')
      .eq('user_id', me).eq('target_type', target).in('target_id', ids)) as VoteRow[];
    return rows.map(toVote);
  }

  async getPostMeta(ids: string[]): Promise<Record<string, PostMeta>> {
    if (!ids.length) return {};
    const me = await this.uid();
    const [stats, votes, saved] = await Promise.all([
      this.client.rpc('post_stats', { ids }),
      this.client.from('votes').select('*').eq('user_id', me).eq('target_type', 'post').in('target_id', ids),
      this.client.from('bookmarks').select('item_id').eq('user_id', me).eq('type', 'post').in('item_id', ids),
    ]);
    const myVotes = new Map((ok(votes) as VoteRow[]).map((v) => [v.target_id, toVote(v)]));
    const savedIds = new Set((ok(saved) as { item_id: string }[]).map((b) => b.item_id));
    const out: Record<string, PostMeta> = {};
    for (const id of ids) out[id] = { score: 0, vote: myVotes.get(id) ?? null, saved: savedIds.has(id), comments: 0, solved: false };
    for (const s of ok(stats) as { post_id: string; score: number; comments: number; solved: boolean }[]) {
      if (out[s.post_id]) Object.assign(out[s.post_id], { score: s.score, comments: s.comments, solved: s.solved });
    }
    return out;
  }

  async getReceivedFeedback(): Promise<ReceivedFeedback> {
    const rows = ok(await this.client.rpc('my_received_feedback')) as
      { upvotes: number; downvotes: number; accepted_by_others: number }[] | null;
    const r = rows?.[0];
    return { upvotes: r?.upvotes ?? 0, downvotes: r?.downvotes ?? 0, acceptedByOthers: r?.accepted_by_others ?? 0 };
  }

  // ---- bookmarks -------------------------------------------------------------
  async listBookmarks(): Promise<Bookmark[]> {
    const me = await this.uid();
    const rows = ok(await this.client.from('bookmarks').select('*').eq('user_id', me)
      .order('created_at', { ascending: false }).limit(BOOKMARK_LIMIT)) as BookmarkRow[];
    return rows.map((r) => ({ type: r.type, itemId: r.item_id, createdAt: Date.parse(r.created_at) }));
  }

  async isBookmarked(type: BookmarkType, itemId: string): Promise<boolean> {
    const me = await this.uid();
    const r = ok(await this.client.from('bookmarks').select('item_id')
      .eq('user_id', me).eq('type', type).eq('item_id', itemId).maybeSingle());
    return !!r;
  }

  async toggleBookmark(type: BookmarkType, itemId: string): Promise<boolean> {
    const me = await this.uid();
    if (await this.isBookmarked(type, itemId)) {
      ok(await this.client.from('bookmarks').delete().eq('user_id', me).eq('type', type).eq('item_id', itemId));
      return false;
    }
    ok(await this.client.from('bookmarks').upsert({ user_id: me, type, item_id: itemId }, { onConflict: 'user_id,type,item_id' }));
    return true;
  }

  // ---- reports ---------------------------------------------------------------
  async reportPost(postId: string, reason: string) {
    const me = await this.uid();
    ok(await this.client.from('reports').upsert(
      { user_id: me, post_id: postId, reason }, { onConflict: 'user_id,post_id', ignoreDuplicates: true }));
  }

  async listReportedPostIds(): Promise<string[]> {
    const me = await this.uid();
    return (ok(await this.client.from('reports').select('post_id').eq('user_id', me)) as { post_id: string }[]).map((r) => r.post_id);
  }

  // ---- resources -------------------------------------------------------------
  async listResources(): Promise<Resource[]> {
    return (ok(await this.client.from('resources').select('*').order('sort')) as ResourceRow[]).map(toResource);
  }

  async getResource(id: string): Promise<Resource | null> {
    const r = ok(await this.client.from('resources').select('*').eq('id', id).maybeSingle()) as ResourceRow | null;
    return r ? toResource(r) : null;
  }

  // ---- mood ------------------------------------------------------------------
  async addMoodCheckin(mood: Mood, tags: MoodTag[] = []): Promise<MoodCheckin> {
    const r = ok(await this.client.from('mood_checkins').insert({ mood, tags }).select('*').single()) as MoodRow;
    return { id: r.id, mood: r.mood, tags: r.tags, createdAt: Date.parse(r.created_at) };
  }

  async listMoodCheckins(): Promise<MoodCheckin[]> {
    const me = await this.uid();
    const rows = ok(await this.client.from('mood_checkins').select('*').eq('user_id', me)
      .order('created_at', { ascending: false }).limit(1000)) as MoodRow[];
    return rows.map((r) => ({ id: r.id, mood: r.mood, tags: r.tags, createdAt: Date.parse(r.created_at) }));
  }

  // ---- notifications ---------------------------------------------------------
  async listNotifications(): Promise<AppNotification[]> {
    const me = await this.uid();
    const rows = ok(await this.client.from('notifications').select('*').eq('user_id', me)
      .order('created_at', { ascending: false }).limit(50)) as NotificationRow[];
    return rows.map((r) => ({
      id: r.id, kind: r.kind, title: r.title, body: r.body, postId: r.post_id, read: r.read, createdAt: Date.parse(r.created_at),
    }));
  }

  async markNotificationsRead() {
    const me = await this.uid();
    ok(await this.client.from('notifications').update({ read: true }).eq('user_id', me).eq('read', false));
  }

  // ---- wellbeing sessions ----------------------------------------------------
  async addSession(kind: WellnessKind, slug: string, minutes: number): Promise<WellnessSession> {
    const r = ok(await this.client.from('wellness_sessions')
      .insert({ kind, slug, minutes: Math.round(minutes * 10) / 10 }).select('*').single()) as
      { id: string; kind: WellnessKind; slug: string; minutes: number; created_at: string };
    return { id: r.id, kind: r.kind, slug: r.slug, minutes: Number(r.minutes), createdAt: Date.parse(r.created_at) };
  }

  async listSessions(): Promise<WellnessSession[]> {
    const me = await this.uid();
    const rows = ok(await this.client.from('wellness_sessions').select('*').eq('user_id', me)
      .order('created_at', { ascending: false }).limit(1000)) as
      { id: string; kind: WellnessKind; slug: string; minutes: number; created_at: string }[];
    return rows.map((r) => ({ id: r.id, kind: r.kind, slug: r.slug, minutes: Number(r.minutes), createdAt: Date.parse(r.created_at) }));
  }

  async getOrgPulse(days = 30): Promise<OrgPulse | null> {
    const [m, f] = await Promise.all([
      this.client.rpc('org_pulse', { p_days: days }), this.client.rpc('org_pulse_factors', { p_days: days }),
    ]);
    const moods = ok(m) as { mood: Mood; n: number; people: number }[];
    if (!moods.length) return null;
    return {
      people: moods[0].people,
      moods: moods.map((r) => ({ mood: r.mood, count: r.n })),
      factors: (ok(f) as { tag: MoodTag; n: number }[]).map((r) => ({ tag: r.tag, count: r.n })),
    };
  }

  // ---- people who understand / chat ------------------------------------------
  async discoverPeople(): Promise<PersonMatch[]> {
    const rows = ok(await this.client.rpc('discover_people', { p_limit: 10 })) as
      { code: string; alias: string; role: string | null; experience: string | null; shared_topics: number; score: number }[];
    return rows.map((r) => ({
      code: r.code, alias: r.alias, role: r.role, experience: r.experience, sharedTopics: r.shared_topics, score: r.score,
    }));
  }

  async requestChat(code: string, intro: string, showRole: boolean): Promise<string> {
    return ok(await this.client.rpc('request_chat', { p_code: code, p_intro: intro, p_show_role: showRole })) as string;
  }

  async listConversations(): Promise<Conversation[]> {
    const rows = ok(await this.client.from('my_conversations').select('*').order('last_at', { ascending: false, nullsFirst: false })) as {
      id: string; status: ConversationStatus; i_requested: boolean; other_alias: string; other_name: string | null;
      other_role: string | null; other_experience: string | null; i_revealed: boolean; other_revealed: boolean; muted: boolean;
      last_body: string | null; last_at: string | null; unread: number; created_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id, status: r.status, iRequested: r.i_requested, otherAlias: r.other_alias, otherName: r.other_name,
      otherRole: r.other_role, otherExperience: r.other_experience, iRevealed: r.i_revealed, otherRevealed: r.other_revealed,
      muted: r.muted, lastBody: r.last_body, lastAt: r.last_at ? Date.parse(r.last_at) : null, unread: r.unread,
      createdAt: Date.parse(r.created_at),
    }));
  }

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    const rows = ok(await this.client.from('my_messages').select('*').eq('conversation_id', conversationId)
      .order('created_at').limit(500)) as { id: string; conversation_id: string; body: string; created_at: string; mine: boolean }[];
    return rows.map((r) => ({ id: r.id, conversationId: r.conversation_id, body: r.body, createdAt: Date.parse(r.created_at), mine: r.mine }));
  }

  async respondChat(conversationId: string, accept: boolean, showRole = false) {
    ok(await this.client.rpc('respond_chat', { p_id: conversationId, p_accept: accept, p_show_role: showRole }));
  }
  async sendMessage(conversationId: string, body: string) {
    ok(await this.client.rpc('send_message', { p_id: conversationId, p_body: body }));
  }
  async markChatRead(conversationId: string) {
    ok(await this.client.rpc('mark_chat_read', { p_id: conversationId }));
  }
  async setChatFlag(conversationId: string, flag: ChatFlag, value: boolean) {
    ok(await this.client.rpc('set_chat_flag', { p_id: conversationId, p_flag: flag, p_value: value }));
  }
  async leaveChat(conversationId: string) {
    ok(await this.client.rpc('leave_chat', { p_id: conversationId }));
  }
  async blockChat(conversationId: string) {
    ok(await this.client.rpc('block_user', { p_id: conversationId }));
  }
  async reportChat(conversationId: string, reason: string) {
    ok(await this.client.rpc('report_chat', { p_id: conversationId, p_reason: reason }));
  }
  async getChatUnread(): Promise<number> {
    return (ok(await this.client.rpc('chat_unread')) as number | null) ?? 0;
  }

  // ---- recognition -----------------------------------------------------------
  async giveShoutout(email: string, badge: ShoutoutBadge, message: string, anonymous: boolean) {
    ok(await this.client.rpc('give_shoutout', { p_email: email, p_badge: badge, p_message: message, p_anonymous: anonymous }));
  }

  async listMyShoutouts(): Promise<ReceivedShoutout[]> {
    const rows = ok(await this.client.from('my_shoutouts').select('*').order('created_at', { ascending: false }).limit(100)) as
      { id: string; badge: ShoutoutBadge; message: string; created_at: string; shared: boolean; from_name: string | null }[];
    return rows.map((r) => ({
      id: r.id, badge: r.badge, message: r.message, createdAt: Date.parse(r.created_at), shared: r.shared, fromName: cleanName(r.from_name),
    }));
  }

  async listShoutoutWall(): Promise<WallShoutout[]> {
    const rows = ok(await this.client.from('shoutout_wall').select('*').order('created_at', { ascending: false }).limit(50)) as
      { id: string; badge: ShoutoutBadge; message: string; created_at: string; to_name: string | null; from_name: string | null }[];
    return rows.map((r) => ({
      id: r.id, badge: r.badge, message: r.message, createdAt: Date.parse(r.created_at),
      toName: cleanName(r.to_name), fromName: cleanName(r.from_name),
    }));
  }

  async shareShoutout(id: string, shared: boolean) {
    ok(await this.client.rpc('share_shoutout', { p_id: id, p_shared: shared }));
  }

  // ---- anonymous feedback ----------------------------------------------------
  async submitFeedback(category: FeedbackCategory, body: string) {
    ok(await this.client.rpc('submit_feedback', { p_category: category, p_body: body }));
  }

  async getFeedbackReport(month: Date): Promise<FeedbackRow[]> {
    const day = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    const rows = ok(await this.client.rpc('feedback_report', { p_month: day })) as
      { category: FeedbackCategory; n: number; prev_n: number | null }[];
    return rows.map((r) => ({ category: r.category, count: r.n, previous: r.prev_n }));
  }

  // ---- stats and account -----------------------------------------------------
  async getCommunityStats(days = 30): Promise<CommunityStat[]> {
    const rows = ok(await this.client.rpc('community_stats', { days })) as { kind: PostKind; category: string; n: number }[];
    return rows.map((r) => ({ kind: r.kind, category: r.category, count: r.n }));
  }

  async deleteAccount() {
    // Remove this person's uploaded photos first (the account cannot reach them afterwards).
    const me = await this.uid();
    try {
      const { data: files } = await this.client.storage.from(IMAGE_BUCKET).list(me, { limit: 1000 });
      if (files?.length) await this.client.storage.from(IMAGE_BUCKET).remove(files.map((f) => `${me}/${f.name}`));
    } catch { /* if the photos cannot be listed, the account is still deleted */ }
    ok(await this.client.rpc('delete_my_data'));
    await this.client.auth.signOut({ scope: 'local' });
  }
}
