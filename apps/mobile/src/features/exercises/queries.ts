import { eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { exercises, type Exercise } from '@/db/schema';

export async function listExercises(): Promise<Exercise[]> {
  return db.select().from(exercises).where(isNull(exercises.deletedAt));
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, id));
  return rows[0] ?? null;
}
