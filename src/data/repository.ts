import type {
  AppNotification, Bookmark, BookmarkType, ChatFlag, ChatMessage, Comment, Community, CommunityStat, Conversation, DownvoteReason,
  FeedbackCategory, FeedbackRow, Mood, MoodCheckin, MoodTag, NewPostInput, NewProfileInput, NotificationPrefs, OrgPulse, PersonMatch,
  PollState, Post, PostKind, PostMeta, Profile, ProfilePatch, ReceivedFeedback, ReceivedShoutout, Resource, ShoutoutBadge, Topic,
  Vote, VoteTarget, VoteValue, WallShoutout, WellnessKind, WellnessSession,
} from './types';

/**
 * The single seam between UI and storage. The app implements it on Supabase (SupabaseRepository);
 * MemoryRepository is the in-memory reference used by unit tests. Methods that write throw when
 * the request fails, so screens can tell the user nothing was saved.
 */
export interface Repository {
  init(): Promise<void>;

  getProfile(): Promise<Profile | null>;
  createProfile(input: NewProfileInput): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile | null>;
  setOnboardingComplete(): Promise<void>;

  listTopics(): Promise<Topic[]>;
  getSelectedTopicIds(): Promise<string[]>;
  saveSelectedTopicIds(ids: string[]): Promise<void>;

  listPosts(kind?: PostKind, communityId?: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  /** Polls are created together with their options (input.pollOptions). */
  createPost(input: NewPostInput): Promise<Post>;
  updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>): Promise<Post | null>;
  deletePost(id: string): Promise<void>;
  /** Shrinks and uploads a picked image; returns the storage path to put in NewPostInput.attachments. */
  uploadImage(localUri: string): Promise<string>;
  /** Short-lived URLs for attachment paths. */
  getImageUrls(paths: string[]): Promise<Record<string, string>>;

  getPoll(postId: string): Promise<PollState>;
  votePoll(postId: string, optionId: string): Promise<void>;

  listComments(postId: string): Promise<Comment[]>;
  /** Comments the signed-in user wrote, across all posts. */
  listMyComments(): Promise<Comment[]>;
  addComment(postId: string, body: string, showAuthor?: boolean): Promise<Comment>;
  /** Question author marks one answer as accepted (null clears it). */
  acceptAnswer(postId: string, commentId: string | null): Promise<void>;

  /** The signed-in user's vote on an item, if any. */
  getVote(target: VoteTarget, id: string): Promise<Vote | null>;
  /** value null removes the vote. Downvotes need a reason. */
  setVote(target: VoteTarget, id: string, value: VoteValue | null, reason?: DownvoteReason | null): Promise<void>;
  /** Total score per item (everyone's votes). */
  getScores(target: VoteTarget, ids: string[]): Promise<Record<string, number>>;
  /** The signed-in user's votes on the given items. */
  listVotes(target: VoteTarget, ids: string[]): Promise<Vote[]>;
  /** Score, vote, saved flag and answer count for each post, fetched together. */
  getPostMeta(ids: string[]): Promise<Record<string, PostMeta>>;
  /** What colleagues gave the signed-in user (for the contribution score). */
  getReceivedFeedback(): Promise<ReceivedFeedback>;

  listCommunities(): Promise<Community[]>;
  setFollowing(communityId: string, follow: boolean): Promise<void>;

  listBookmarks(): Promise<Bookmark[]>;
  isBookmarked(type: BookmarkType, itemId: string): Promise<boolean>;
  toggleBookmark(type: BookmarkType, itemId: string): Promise<boolean>;

  reportPost(postId: string, reason: string): Promise<void>;
  listReportedPostIds(): Promise<string[]>;

  listResources(): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | null>;

  addMoodCheckin(mood: Mood, tags?: MoodTag[]): Promise<MoodCheckin>;
  listMoodCheckins(): Promise<MoodCheckin[]>;
  /** Aggregated across colleagues; null while fewer than 5 people have checked in. */
  getOrgPulse(days?: number): Promise<OrgPulse | null>;

  addSession(kind: WellnessKind, slug: string, minutes: number): Promise<WellnessSession>;
  listSessions(): Promise<WellnessSession[]>;

  // People who understand / 1-to-1 chat
  discoverPeople(): Promise<PersonMatch[]>;
  requestChat(code: string, intro: string, showRole: boolean): Promise<string>;
  listConversations(): Promise<Conversation[]>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  respondChat(conversationId: string, accept: boolean, showRole?: boolean): Promise<void>;
  sendMessage(conversationId: string, body: string): Promise<void>;
  markChatRead(conversationId: string): Promise<void>;
  setChatFlag(conversationId: string, flag: ChatFlag, value: boolean): Promise<void>;
  leaveChat(conversationId: string): Promise<void>;
  blockChat(conversationId: string): Promise<void>;
  reportChat(conversationId: string, reason: string): Promise<void>;
  /** Unread messages plus waiting requests. */
  getChatUnread(): Promise<number>;

  // Recognition
  giveShoutout(email: string, badge: ShoutoutBadge, message: string, anonymous: boolean): Promise<void>;
  listMyShoutouts(): Promise<ReceivedShoutout[]>;
  listShoutoutWall(): Promise<WallShoutout[]>;
  shareShoutout(id: string, shared: boolean): Promise<void>;

  // Anonymous feedback to ABB
  submitFeedback(category: FeedbackCategory, body: string): Promise<void>;
  getFeedbackReport(month: Date): Promise<FeedbackRow[]>;

  listNotifications(): Promise<AppNotification[]>;
  markNotificationsRead(): Promise<void>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(p: NotificationPrefs): Promise<void>;

  /** Anonymous counts of community posts by topic over the last `days` days. */
  getCommunityStats(days?: number): Promise<CommunityStat[]>;

  /** Deletes the account and everything stored for it. Irreversible. */
  deleteAccount(): Promise<void>;
}
