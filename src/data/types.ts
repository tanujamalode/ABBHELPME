export type PostKind = 'personal' | 'work_question' | 'achievement' | 'discussion' | 'poll' | 'idea';
export type Mood = 'great' | 'okay' | 'not_great' | 'struggling';
export type ResourceGroup = 'wellbeing' | 'hr' | 'it' | 'workplace' | 'support' | 'faq' | 'policy';

export interface Profile {
  id: string;
  displayName: string;
  lockEnabled: boolean;
  onboardingComplete: boolean;
  createdAt: number;
  /** Role id from ROLE_OPTIONS; null if not chosen. */
  role: string | null;
  /** Experience band id from EXPERIENCE_OPTIONS; null if not chosen. */
  experience: string | null;
  /** Appears in "People who understand" (role and experience shown, name never). */
  discoverable: boolean;
  /** The email code was confirmed (Supabase email sign-in). */
  verified: boolean;
}

/** Fields a user can change after sign-up. */
export type ProfilePatch = Partial<Pick<Profile, 'displayName' | 'role' | 'experience' | 'lockEnabled' | 'discoverable'>>;

export interface NewProfileInput {
  displayName: string;
  lockEnabled: boolean;
  role: string | null;
  experience: string | null;
}

/** Shown on a post or answer when the author chooses to. Never includes a name. */
export interface AuthorMeta {
  role: string | null;
  experience: string | null;
  verified: boolean;
}

export interface Topic {
  id: string;
  label: string;
}

export interface Post {
  id: string;
  kind: PostKind;
  category: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  /** Written by the signed-in user. Everything else was written by a colleague. */
  mine: boolean;
  /** Community the post belongs to, if any. */
  communityId: string | null;
  /** Storage paths of attached images (see getImageUrls). */
  attachments: string[];
  /** Written by a leader of its community. */
  isLeader: boolean;
  /** Snapshot of the author's role/experience, only if they chose to show it. */
  author: AuthorMeta | null;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  createdAt: number;
  mine: boolean;
  author: AuthorMeta | null;
  /** Marked as the accepted answer by the question's author. */
  accepted: boolean;
}

export type VoteTarget = 'post' | 'comment';
/** +1 upvote, -1 downvote (answers only, with a reason). */
export type VoteValue = 1 | -1;
export const DOWNVOTE_REASONS = ['Incorrect', 'Outdated', 'Not helpful', 'Off-topic'] as const;
export type DownvoteReason = (typeof DOWNVOTE_REASONS)[number];
export interface Vote {
  target: VoteTarget;
  targetId: string;
  value: VoteValue;
  reason: DownvoteReason | null;
  createdAt: number;
}

export interface Resource {
  id: string;
  group: ResourceGroup;
  title: string;
  subtitle: string;
  body: string;
  /** Only set when project-provided contact data exists; never invented. */
  url?: string;
  phone?: string;
  email?: string;
  verified: boolean;
  /** Who published it: ABB, or an outside organisation (shown clearly in the UI). */
  source: 'ABB' | 'External';
  /** ISO date (YYYY-MM-DD) of the last review, if it has been reviewed. */
  reviewedAt: string | null;
}

export const MOOD_TAGS = ['workload', 'sleep', 'team', 'family', 'health', 'learning', 'recognition'] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

export interface MoodCheckin {
  id: string;
  mood: Mood;
  tags: MoodTag[];
  createdAt: number;
}

export type BookmarkType = 'post' | 'resource' | 'session' | 'conversation';
export interface Bookmark {
  type: BookmarkType;
  itemId: string;
  createdAt: number;
}

export interface NotificationPrefs {
  dailyReminder: boolean;
  resourceTips: boolean;
  hydration: boolean;
  microBreak: boolean;
}

export interface NewPostInput {
  kind: PostKind;
  category: string;
  title: string;
  body: string;
  /** Attach the author's role/experience to the post. */
  showAuthor?: boolean;
  communityId?: string | null;
  /** Storage paths returned by uploadImage (up to 4). */
  attachments?: string[];
  /** Poll options (2 to 6). Required when kind is 'poll'. */
  pollOptions?: string[];
}

/** Everything a post card shows besides the post itself. */
export interface PostMeta {
  score: number;
  /** The signed-in user's vote on the post. */
  vote: Vote | null;
  saved: boolean;
  comments: number;
  solved: boolean;
}

export type NotificationKind = 'answer' | 'comment' | 'accepted' | 'shoutout';
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  postId: string | null;
  read: boolean;
  createdAt: number;
}

/** Votes and accepted answers other people gave this user. */
export interface ReceivedFeedback {
  upvotes: number;
  downvotes: number;
  acceptedByOthers: number;
}

/** Anonymous organisation-wide count of posts in a topic (groups under 3 are never returned). */
export interface CommunityStat {
  kind: PostKind;
  category: string;
  count: number;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  members: number;
  postsThisWeek: number;
  following: boolean;
}

export interface PollOption { id: string; label: string; votes: number; mine: boolean }
export interface PollState {
  options: PollOption[];
  /** Totals are only returned once you have voted (or wrote the poll). */
  revealed: boolean;
  total: number;
}

export type ConversationStatus = 'pending' | 'active' | 'declined' | 'closed';
export interface Conversation {
  id: string;
  status: ConversationStatus;
  iRequested: boolean;
  /** A made-up name for this conversation, e.g. "Quiet Otter". */
  otherAlias: string;
  /** Only set once the other person has revealed themselves. */
  otherName: string | null;
  otherRole: string | null;
  otherExperience: string | null;
  iRevealed: boolean;
  otherRevealed: boolean;
  muted: boolean;
  lastBody: string | null;
  lastAt: number | null;
  unread: number;
  createdAt: number;
}
export interface ChatMessage { id: string; conversationId: string; body: string; createdAt: number; mine: boolean }
export type ChatFlag = 'muted' | 'reveal';

export interface PersonMatch {
  /** Opaque handle used to ask for a chat. Never an account id. */
  code: string;
  alias: string;
  role: string | null;
  experience: string | null;
  sharedTopics: number;
  score: number;
}

export type WellnessKind = 'meditation' | 'breathing' | 'sleep' | 'microbreak';
export interface WellnessSession { id: string; kind: WellnessKind; slug: string; minutes: number; createdAt: number }

export const SHOUTOUT_BADGES = ['thanks', 'teamwork', 'above_beyond', 'creative', 'helpful', 'kind'] as const;
export type ShoutoutBadge = (typeof SHOUTOUT_BADGES)[number];
export interface Shoutout {
  id: string;
  badge: ShoutoutBadge;
  message: string;
  createdAt: number;
  /** Names are null when the sender chose to stay anonymous, or the colleague never set one. */
  fromName: string | null;
}
export interface ReceivedShoutout extends Shoutout { shared: boolean }
export interface WallShoutout extends Shoutout { toName: string | null }

export const FEEDBACK_CATEGORIES = ['workplace', 'wellbeing', 'facilities', 'management', 'technology', 'culture', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export interface FeedbackRow { category: FeedbackCategory; count: number; previous: number | null }

/** Aggregated wellbeing pulse across colleagues. Null when fewer than 5 people have checked in. */
export interface OrgPulse {
  people: number;
  moods: { mood: Mood; count: number }[];
  factors: { tag: MoodTag; count: number }[];
}
