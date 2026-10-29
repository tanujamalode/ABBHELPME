export type PostKind = 'personal' | 'work_question' | 'achievement';
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
  /** Phase 1: always true via the demo verifier. Phase 2: set by real employee verification. */
  verified: boolean;
}

/** Fields a user can change after sign-up. */
export type ProfilePatch = Partial<Pick<Profile, 'displayName' | 'role' | 'experience' | 'lockEnabled'>>;

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
  /** true for bundled demo content; false for entries written on this device */
  sample: boolean;
  /** Stored in the shared cloud community (then `sample` is true when a colleague wrote it). */
  shared?: boolean;
  /** Snapshot of the author's role/experience, only if they chose to show it. */
  author: AuthorMeta | null;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  createdAt: number;
  sample: boolean;
  shared?: boolean;
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
}

export const MOOD_TAGS = ['workload', 'sleep', 'team', 'family', 'health', 'learning', 'recognition'] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

export interface MoodCheckin {
  id: string;
  mood: Mood;
  tags: MoodTag[];
  createdAt: number;
}

export type BookmarkType = 'post' | 'resource';
export interface Bookmark {
  type: BookmarkType;
  itemId: string;
  createdAt: number;
}

export interface NotificationPrefs {
  dailyReminder: boolean;
  resourceTips: boolean;
}

export interface NewPostInput {
  kind: PostKind;
  category: string;
  title: string;
  body: string;
  /** Attach the author's role/experience to the post. */
  showAuthor?: boolean;
  /** Backdate the post (demo data only). */
  createdAt?: number;
}
