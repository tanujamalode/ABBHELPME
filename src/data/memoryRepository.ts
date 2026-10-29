import { newId } from '@/lib/id';
import { TOPIC_CATALOGUE } from '@/lib/topics';
import { DEFAULT_NOTIFICATION_PREFS, authorSnapshot } from './shared';
import type { Repository } from './repository';
import type {
  AppNotification, Bookmark, BookmarkType, ChatFlag, ChatMessage, Comment, Community, CommunityStat, Conversation, DownvoteReason,
  FeedbackCategory, FeedbackRow, Mood, MoodCheckin, MoodTag, NewPostInput, NewProfileInput, NotificationPrefs, OrgPulse, PersonMatch,
  PollState, Post, PostKind, PostMeta, Profile, ProfilePatch, ReceivedFeedback, ReceivedShoutout, Resource, ShoutoutBadge, Topic,
  Vote, VoteTarget, VoteValue, WallShoutout, WellnessKind, WellnessSession,
} from './types';

const unsupported = () => { throw new Error('Not available in the in-memory repository'); };

/**
 * In-memory, single-user implementation of the repository. Unit tests use it as the reference for the
 * interface's behaviour; the app itself runs on SupabaseRepository.
 */
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
  private sessions: WellnessSession[] = [];
  private polls = new Map<string, { options: { id: string; label: string }[]; choice: string | null }>();
  resources: Resource[] = [];

  async init() {}

  async getProfile() { return this.profile; }
  async createProfile(input: NewProfileInput): Promise<Profile> {
    this.profile = {
      id: newId(), displayName: input.displayName.trim() || 'there', lockEnabled: input.lockEnabled, onboardingComplete: false,
      createdAt: Date.now(), role: input.role, experience: input.experience, verified: true, discoverable: false,
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

  async listPosts(kind?: PostKind, communityId?: string) {
    return this.posts.filter((p) => (!kind || p.kind === kind) && (!communityId || p.communityId === communityId))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async getPost(id: string) { return this.posts.find((p) => p.id === id) ?? null; }
  async createPost(input: NewPostInput): Promise<Post> {
    const now = Date.now();
    const post: Post = {
      id: newId(), kind: input.kind, category: input.category, title: input.title.trim(), body: input.body.trim(),
      createdAt: now, updatedAt: now, mine: true, author: authorSnapshot(this.profile, input.showAuthor),
      communityId: input.communityId ?? null, attachments: input.attachments ?? [], isLeader: false,
    };
    this.posts.unshift(post);
    if (input.kind === 'poll') {
      this.polls.set(post.id, { options: (input.pollOptions ?? []).map((label, i) => ({ id: `${post.id}-o${i}`, label })), choice: null });
    }
    return post;
  }
  async uploadImage(): Promise<string> { return unsupported(); }
  async getImageUrls(): Promise<Record<string, string>> { return {}; }
  async getPoll(postId: string): Promise<PollState> {
    const poll = this.polls.get(postId);
    const mine = this.posts.some((p) => p.id === postId && p.mine);
    const revealed = !!poll?.choice || mine;
    const options = (poll?.options ?? []).map((o) => ({ ...o, votes: revealed && poll?.choice === o.id ? 1 : 0, mine: poll?.choice === o.id }));
    return { options, revealed, total: options.reduce((n, o) => n + o.votes, 0) };
  }
  async votePoll(postId: string, optionId: string) {
    const poll = this.polls.get(postId);
    if (poll) poll.choice = optionId;
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
    return this.comments.filter((c) => c.postId === postId)
      .map((c) => ({ ...c, accepted: this.accepted.get(postId) === c.id })).sort((a, b) => a.createdAt - b.createdAt);
  }
  async listMyComments() {
    return this.comments.filter((c) => c.mine).map((c) => ({ ...c, accepted: this.accepted.get(c.postId) === c.id }));
  }
  async addComment(postId: string, body: string, showAuthor?: boolean): Promise<Comment> {
    const c: Comment = {
      id: newId(), postId, body: body.trim(), createdAt: Date.now(), mine: true, accepted: false,
      author: authorSnapshot(this.profile, showAuthor),
    };
    this.comments.push(c);
    return c;
  }
  async acceptAnswer(postId: string, commentId: string | null) {
    if (!this.posts.some((p) => p.id === postId && p.mine)) return; // only the question's author
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
    for (const id of ids) out[id] = this.votes.get(`${target}:${id}`)?.value ?? 0;
    return out;
  }
  async listVotes(target: VoteTarget, ids: string[]) {
    return [...this.votes.values()].filter((v) => v.target === target && ids.includes(v.targetId));
  }
  async getPostMeta(ids: string[]) {
    const out: Record<string, PostMeta> = {};
    for (const id of ids) {
      const vote = this.votes.get(`post:${id}`) ?? null;
      out[id] = {
        score: vote?.value ?? 0, vote, saved: this.bookmarks.some((b) => b.type === 'post' && b.itemId === id),
        comments: this.comments.filter((c) => c.postId === id).length, solved: this.accepted.has(id),
      };
    }
    return out;
  }
  async getReceivedFeedback(): Promise<ReceivedFeedback> { return { upvotes: 0, downvotes: 0, acceptedByOthers: 0 }; }

  async listCommunities(): Promise<Community[]> { return []; }
  async setFollowing() {}

  async listBookmarks() { return [...this.bookmarks]; }
  async isBookmarked(type: BookmarkType, itemId: string) { return this.bookmarks.some((b) => b.type === type && b.itemId === itemId); }
  async toggleBookmark(type: BookmarkType, itemId: string) {
    const i = this.bookmarks.findIndex((b) => b.type === type && b.itemId === itemId);
    if (i >= 0) { this.bookmarks.splice(i, 1); return false; }
    this.bookmarks.push({ type, itemId, createdAt: Date.now() }); return true;
  }

  async reportPost(postId: string, reason: string) { this.reports.push({ postId, reason }); }
  async listReportedPostIds() { return this.reports.map((r) => r.postId); }

  async listResources() { return [...this.resources]; }
  async getResource(id: string) { return this.resources.find((r) => r.id === id) ?? null; }

  async addMoodCheckin(mood: Mood, tags: MoodTag[] = []): Promise<MoodCheckin> {
    const m = { id: newId(), mood, tags: [...tags], createdAt: Date.now() };
    this.moods.push(m); return m;
  }
  async listMoodCheckins() { return [...this.moods].sort((a, b) => b.createdAt - a.createdAt); }

  async getOrgPulse(): Promise<OrgPulse | null> { return null; }

  async addSession(kind: WellnessKind, slug: string, minutes: number): Promise<WellnessSession> {
    const session = { id: newId(), kind, slug, minutes, createdAt: Date.now() };
    this.sessions.unshift(session);
    return session;
  }
  async listSessions() { return [...this.sessions]; }

  async discoverPeople(): Promise<PersonMatch[]> { return []; }
  async requestChat(_code: string, _intro: string, _showRole: boolean): Promise<string> { return unsupported(); }
  async listConversations(): Promise<Conversation[]> { return []; }
  async listMessages(_id: string): Promise<ChatMessage[]> { return []; }
  async respondChat(_id: string, _accept: boolean, _showRole?: boolean) { unsupported(); }
  async sendMessage(_id: string, _body: string) { unsupported(); }
  async markChatRead(_id: string) {}
  async setChatFlag(_id: string, _flag: ChatFlag, _value: boolean) { unsupported(); }
  async leaveChat(_id: string) { unsupported(); }
  async blockChat(_id: string) { unsupported(); }
  async reportChat(_id: string, _reason: string) { unsupported(); }
  async getChatUnread() { return 0; }

  async giveShoutout(_email: string, _badge: ShoutoutBadge, _message: string, _anonymous: boolean) { unsupported(); }
  async listMyShoutouts(): Promise<ReceivedShoutout[]> { return []; }
  async listShoutoutWall(): Promise<WallShoutout[]> { return []; }
  async shareShoutout(_id: string, _shared: boolean) { unsupported(); }

  async submitFeedback(_category: FeedbackCategory, _body: string) { unsupported(); }
  async getFeedbackReport(_month: Date): Promise<FeedbackRow[]> { return []; }

  async listNotifications(): Promise<AppNotification[]> { return []; }
  async markNotificationsRead() {}

  async getNotificationPrefs() { return { ...this.prefs }; }
  async setNotificationPrefs(p: NotificationPrefs) { this.prefs = { ...p }; }

  async getCommunityStats(): Promise<CommunityStat[]> { return []; }

  async deleteAccount() {
    this.profile = null; this.topics = []; this.posts = []; this.comments = [];
    this.accepted.clear(); this.votes.clear(); this.bookmarks = []; this.reports = []; this.moods = []; this.sessions = [];
    this.polls.clear(); this.prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  }
}
