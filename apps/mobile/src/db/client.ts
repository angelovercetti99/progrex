import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as SQLite from 'expo-sqlite';

import * as schema from './schema';

/**
 * The ONE connection to the local database, shared by the whole app.
 *
 * Why a single shared promise: on web, expo-sqlite fails with "Invalid VFS
 * state" if two databases are opened at the same moment during startup.
 *
 * Why async (and Drizzle's `sqlite-proxy` driver instead of its Expo driver):
 * the Expo driver uses synchronous calls, which on web freeze the screen in a
 * busy-wait loop. The async API works well on every platform.
 */
let connectionPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getConnection(): Promise<SQLite.SQLiteDatabase> {
  if (!connectionPromise) {
    connectionPromise = SQLite.openDatabaseAsync('progrex.db').catch((error) => {
      // Let a later call try again instead of caching the failure forever.
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

/**
 * Drizzle hands us the SQL it built; we run it with expo-sqlite and return the
 * rows as arrays of values (the format `sqlite-proxy` expects).
 */
export const db = drizzle(
  async (sql, params, method) => {
    const connection = await getConnection();
    const statement = await connection.prepareAsync(sql);
    try {
      const result = await statement.executeForRawResultAsync(params);
      if (method === 'run') {
        return { rows: [] };
      }
      const rows = await result.getAllAsync();
      // 'get' expects just the first row; 'all' and 'values' expect all rows.
      return { rows: method === 'get' ? rows[0] : rows };
    } finally {
      await statement.finalizeAsync();
    }
  },
  { schema }
);
