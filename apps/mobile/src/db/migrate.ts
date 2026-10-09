import { getConnection } from './client';
import bundled from './migrations/migrations';

/**
 * Applies pending migrations, in order, each in its own transaction.
 *
 * Drizzle ships a migrator for its Expo driver, but we use the async
 * `sqlite-proxy` driver (see client.ts), so we run the same files ourselves.
 * We record progress in the same `__drizzle_migrations` table Drizzle uses.
 */
export async function runMigrations(): Promise<void> {
  const connection = await getConnection();

  await connection.execAsync(
    'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)'
  );

  const last = await connection.getFirstAsync<{ created_at: number }>(
    'SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1'
  );

  for (const entry of bundled.journal.entries) {
    if (last && entry.when <= last.created_at) {
      continue; // Already applied.
    }

    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sql = bundled.migrations[key];
    if (!sql) {
      throw new Error(`Missing migration file for ${entry.tag}`);
    }

    // drizzle-kit separates statements with this marker.
    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean);

    await connection.withTransactionAsync(async () => {
      for (const statement of statements) {
        await connection.execAsync(statement);
      }
      await connection.runAsync(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
        entry.tag,
        entry.when
      );
    });
  }
}
