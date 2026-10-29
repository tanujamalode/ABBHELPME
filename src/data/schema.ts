export interface MigrationDb {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
}

/** Ordered, append-only. Never edit a shipped migration; add a new one. */
export const MIGRATIONS: { version: number; statements: string[] }[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE profile (
         id TEXT PRIMARY KEY NOT NULL, display_name TEXT NOT NULL,
         lock_enabled INTEGER NOT NULL DEFAULT 0,
         onboarding_complete INTEGER NOT NULL DEFAULT 0,
         created_at INTEGER NOT NULL)`,
      `CREATE TABLE topic_preferences (topic_id TEXT PRIMARY KEY NOT NULL)`,
      `CREATE TABLE posts (
         id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL,
         title TEXT NOT NULL, body TEXT NOT NULL,
         created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
      `CREATE INDEX idx_posts_kind_created ON posts(kind, created_at)`,
      `CREATE TABLE comments (
         id TEXT PRIMARY KEY NOT NULL, post_id TEXT NOT NULL,
         body TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE INDEX idx_comments_post ON comments(post_id)`,
      `CREATE TABLE reactions (post_id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE bookmarks (
         type TEXT NOT NULL, item_id TEXT NOT NULL, created_at INTEGER NOT NULL,
         PRIMARY KEY (type, item_id))`,
      `CREATE TABLE reports (
         id TEXT PRIMARY KEY NOT NULL, post_id TEXT NOT NULL,
         reason TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE mood_checkins (
         id TEXT PRIMARY KEY NOT NULL, mood TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
    ],
  },
  {
    // Roles & verification, author snapshots, votes, accepted answers, mood tags.
    version: 2,
    statements: [
      `ALTER TABLE profile ADD COLUMN role TEXT`,
      `ALTER TABLE profile ADD COLUMN experience TEXT`,
      `ALTER TABLE profile ADD COLUMN verified INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE posts ADD COLUMN author_role TEXT`,
      `ALTER TABLE posts ADD COLUMN author_experience TEXT`,
      `ALTER TABLE posts ADD COLUMN show_author INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE comments ADD COLUMN author_role TEXT`,
      `ALTER TABLE comments ADD COLUMN author_experience TEXT`,
      `ALTER TABLE comments ADD COLUMN show_author INTEGER NOT NULL DEFAULT 0`,
      `CREATE TABLE accepted_answers (post_id TEXT PRIMARY KEY NOT NULL, comment_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
      `CREATE TABLE votes (
         target_type TEXT NOT NULL, target_id TEXT NOT NULL, value INTEGER NOT NULL,
         reason TEXT, created_at INTEGER NOT NULL,
         PRIMARY KEY (target_type, target_id))`,
      // Earlier "support" hearts become upvotes; the old table is left in place (append-only migrations).
      `INSERT OR IGNORE INTO votes (target_type, target_id, value, reason, created_at)
         SELECT 'post', post_id, 1, NULL, created_at FROM reactions`,
      `ALTER TABLE mood_checkins ADD COLUMN tags TEXT NOT NULL DEFAULT ''`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function migrate(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.execAsync('BEGIN');
    try {
      for (const s of m.statements) await db.execAsync(s);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
  }
}
