import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { exercises, locations, mesocycles, preferences, sets, workoutExercises, workouts } from '@/db/schema';
import { deleteStamps } from '@/db/stamps';
import { deleteDemoData } from '@/features/demo/queries';

/**
 * What a fresh start forgets on this device. Language, appearance and
 * "show RIR" stay: they're how you like the app, not your training.
 */
const TRAINING_PREFERENCES = ['currentLocationId', 'goal', 'travel', 'quickStartSkipped', 'effortIntroSeen'];

/**
 * "Start from scratch": every workout, plan, place and custom exercise goes,
 * and the app opens on the first-run guide again.
 *
 * Synced rows are never really deleted, only marked (`deleted_at`), so the
 * same reset reaches your other devices once sync exists (Phase 4). Sample
 * data is the exception: it never syncs, so it's deleted for real.
 */
export async function resetAllData(): Promise<void> {
  await deleteDemoData();

  const gone = deleteStamps();
  await db.update(sets).set(gone).where(isNull(sets.deletedAt));
  await db.update(workoutExercises).set(gone).where(isNull(workoutExercises.deletedAt));
  await db.update(workouts).set(gone).where(isNull(workouts.deletedAt));
  await db.update(mesocycles).set(gone).where(isNull(mesocycles.deletedAt));
  await db.update(locations).set(gone).where(isNull(locations.deletedAt));
  // Built-in exercises belong to the app; only your own ones go.
  await db
    .update(exercises)
    .set(gone)
    .where(and(eq(exercises.isBuiltin, false), isNull(exercises.deletedAt)));

  await db.delete(preferences).where(inArray(preferences.key, TRAINING_PREFERENCES));

  notifyChanged(
    'sets',
    'workout_exercises',
    'workouts',
    'mesocycles',
    'locations',
    'exercises',
    'preferences'
  );
}
