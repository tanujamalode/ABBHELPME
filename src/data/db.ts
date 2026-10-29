import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_NAME = 'abbhelpme.dbkey.v1';
export const DB_NAME = 'abbhelpme.db';
const HEX64 = /^[0-9a-f]{64}$/;

/** Random 256-bit key, generated on first run and kept only in the OS keystore. */
export async function getOrCreateDbKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing && HEX64.test(existing)) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, hex, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, // not migrated by backups
  });
  return hex;
}

export async function openEncryptedDb(): Promise<SQLite.SQLiteDatabase> {
  const key = await getOrCreateDbKey();
  if (!HEX64.test(key)) throw new Error('Invalid database key');
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // Raw-key form; the value is validated hex so it cannot alter the statement.
  await db.execAsync(`PRAGMA key = "x'${key}'"`);
  // Fails here if SQLCipher is not enabled or the key is wrong.
  await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
  await db.execAsync('PRAGMA journal_mode = WAL');
  return db;
}

export async function destroyDatabaseAndKey(db: SQLite.SQLiteDatabase | null): Promise<void> {
  try { await db?.closeAsync(); } catch { /* already closed */ }
  try { await SQLite.deleteDatabaseAsync(DB_NAME); } catch { /* none */ }
  await SecureStore.deleteItemAsync(KEY_NAME);
}
