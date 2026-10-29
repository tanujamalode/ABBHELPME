import { LATEST_VERSION, MIGRATIONS, migrate, type MigrationDb } from '@/data/schema';

function fakeDb(startVersion = 0) {
  let version = startVersion;
  const log: string[] = [];
  const db: MigrationDb = {
    async execAsync(sql) {
      log.push(sql);
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) version = Number(m[1]);
    },
    async getFirstAsync() { return { user_version: version } as never; },
  };
  return { db, log, get version() { return version; } };
}

describe('schema migrations', () => {
  it('applies all migrations on a new database and records the version', async () => {
    const f = fakeDb();
    await migrate(f.db);
    expect(f.version).toBe(LATEST_VERSION);
    expect(f.log.filter((s) => s.startsWith('CREATE TABLE')).length).toBeGreaterThanOrEqual(8);
  });

  it('is a no-op when already up to date', async () => {
    const f = fakeDb(LATEST_VERSION);
    await migrate(f.db);
    expect(f.log).toHaveLength(0);
  });

  it('has strictly increasing versions', () => {
    const v = MIGRATIONS.map((m) => m.version);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
    expect(new Set(v).size).toBe(v.length);
  });
});
