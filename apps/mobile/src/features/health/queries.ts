import {
  activeHealth,
  exerciseTraits,
  HealthProfileSchema,
  isAllowed,
  NO_HEALTH,
  type ActiveHealth,
  type HealthProfile,
} from '@progrex/shared';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { mesocycles, type Exercise } from '@/db/schema';
import { todayLocalDate, updateStamps } from '@/db/stamps';
import { getPreference, setPreference } from '@/lib/preferences';

/**
 * Health conditions (docs/decisoes.md §50). Where they live:
 * - in the active plan (`plan.health`), which syncs, so every device follows them;
 * - and in a local preference, for when there's no plan (free workouts) and to
 *   carry them into the next plan.
 * The plan wins when there is one.
 */

const HEALTH_KEY = 'health';

export async function getHealthProfile(): Promise<HealthProfile> {
  const plan = await db
    .select({ plan: mesocycles.plan })
    .from(mesocycles)
    .where(and(eq(mesocycles.status, 'active'), isNull(mesocycles.deletedAt)))
    .get();
  if (plan?.plan.health) return plan.plan.health;

  const stored = await getPreference(HEALTH_KEY);
  if (!stored) return NO_HEALTH;
  try {
    const parsed = HealthProfileSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : NO_HEALTH;
  } catch {
    return NO_HEALTH;
  }
}

/** Saves the conditions, and applies them to the active plan from today. */
export async function setHealthProfile(profile: HealthProfile): Promise<void> {
  await setPreference(HEALTH_KEY, JSON.stringify(profile));
  const active = await db
    .select()
    .from(mesocycles)
    .where(and(eq(mesocycles.status, 'active'), isNull(mesocycles.deletedAt)))
    .get();
  if (active) {
    const { health: _old, ...rest } = active.plan;
    const plan = profile.conditions.length ? { ...rest, health: profile } : rest;
    await db
      .update(mesocycles)
      .set({ plan, ...updateStamps() })
      .where(eq(mesocycles.id, active.id));
    notifyChanged('mesocycles');
  }
}

/** The rules that apply today (the trimester, for example, changes by itself). */
export async function getActiveHealth(): Promise<ActiveHealth> {
  return activeHealth(await getHealthProfile(), todayLocalDate());
}

/** Is this exercise safe with today's conditions? Custom exercises: the user's call. */
export function isExerciseAllowed(exercise: Pick<Exercise, 'nameKey'>, health: ActiveHealth): boolean {
  return isAllowed(exerciseTraits(exercise.nameKey), health);
}
