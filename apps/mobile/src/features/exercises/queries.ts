import { isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, type Exercise } from '@/db/schema';

export async function listExercises(): Promise<Exercise[]> {
  return db.select().from(exercises).where(isNull(exercises.deletedAt));
}
