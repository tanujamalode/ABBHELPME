import type {
  Bookmark, BookmarkType, Comment, DownvoteReason, MoodCheckin, Mood, MoodTag, NewPostInput, NewProfileInput,
  NotificationPrefs, Post, PostKind, Profile, ProfilePatch, Resource, Topic, Vote, VoteTarget, VoteValue,
} from './types';

/**
 * The single seam between UI and storage. Phase 1 implements this on
 * encrypted SQLite (SqliteRepository). A later backend phase can add an
 * ApiRepository that satisfies the same interface without UI changes.
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

  listPosts(kind?: PostKind): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  createPost(input: NewPostInput): Promise<Post>;
  updatePost(id: string, patch: Pick<Post, 'category' | 'title' | 'body'>): Promise<Post | null>;
  deletePost(id: string): Promise<void>;

  listComments(postId: string): Promise<Comment[]>;
  /** Comments written on this device, across all posts. */
  listMyComments(): Promise<Comment[]>;
  addComment(postId: string, body: string, showAuthor?: boolean, at?: number): Promise<Comment>;
  /** Question author marks one answer as accepted (null clears it). Only for local posts. */
  acceptAnswer(postId: string, commentId: string | null): Promise<void>;

  /** This device's vote on an item, if any. */
  getVote(target: VoteTarget, id: string): Promise<Vote | null>;
  /** value null removes the vote. Downvotes need a reason. */
  setVote(target: VoteTarget, id: string, value: VoteValue | null, reason?: DownvoteReason | null): Promise<void>;
  /** Displayed scores: sample baseline plus this device's vote. */
  getScores(target: VoteTarget, ids: string[]): Promise<Record<string, number>>;
  listVotes(): Promise<Vote[]>;

  listBookmarks(): Promise<Bookmark[]>;
  isBookmarked(type: BookmarkType, itemId: string): Promise<boolean>;
  toggleBookmark(type: BookmarkType, itemId: string): Promise<boolean>;

  reportPost(postId: string, reason: string): Promise<void>;
  listReportedPostIds(): Promise<string[]>;

  listResources(): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | null>;

  addMoodCheckin(mood: Mood, tags?: MoodTag[], at?: number): Promise<MoodCheckin>;
  listMoodCheckins(): Promise<MoodCheckin[]>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  setNotificationPrefs(p: NotificationPrefs): Promise<void>;

  /** Removes the profile and every local record. Irreversible. */
  deleteAllLocalData(): Promise<void>;
}
