import { builtinExerciseId, CATALOG } from '@progrex/shared';
import { sql } from 'drizzle-orm';

import { db } from './client';
import { exercises } from './schema';
import { nowIso } from './stamps';

/**
 * Writes the built-in catalog into the database on every startup.
 * "Upsert": new exercises are inserted; existing ones get the latest catalog
 * data (if an app update changed them). Built-ins are never synced.
 */
export async function seedBuiltinExercises(): Promise<void> {
  const now = nowIso();
  const rows = CATALOG.map((exercise) => ({
    id: builtinExerciseId(exercise.key),
    nameKey: exercise.key,
    pattern: exercise.pattern,
    equipment: exercise.equipment,
    loadType: exercise.loadType,
    difficulty: exercise.difficulty,
    loadIncrementKg: exercise.loadIncrementKg,
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
    dirty: false,
  }));

  // Small batches keep each SQL statement short.
  for (let start = 0; start < rows.length; start += 25) {
    await db
      .insert(exercises)
      .values(rows.slice(start, start + 25))
      .onConflictDoUpdate({
        target: exercises.id,
        set: {
          nameKey: sql`excluded.name_key`,
          pattern: sql`excluded.pattern`,
          equipment: sql`excluded.equipment`,
          loadType: sql`excluded.load_type`,
          difficulty: sql`excluded.difficulty`,
          loadIncrementKg: sql`excluded.load_increment_kg`,
        },
      });
  }
}
