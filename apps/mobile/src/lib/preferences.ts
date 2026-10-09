import { GoalSchema, type Goal } from '@progrex/shared';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { preferences } from '@/db/schema';

/**
 * Small local settings (key → value), stored in the `preferences` table.
 * Not synced: they belong to this device.
 */

export type LanguagePreference = 'system' | 'pt' | 'en';

const LANGUAGE_KEY = 'language';
const CURRENT_LOCATION_KEY = 'currentLocationId';
const GOAL_KEY = 'goal';

/** Until the user picks one, train for muscle. */
export const DEFAULT_GOAL: Goal = 'hypertrophy';

export async function getPreference(key: string): Promise<string | null> {
  const row = await db.select().from(preferences).where(eq(preferences.key, key)).get();
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  await db
    .insert(preferences)
    .values({ key, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } });
  notifyChanged('preferences');
}

export async function getLanguagePreference(): Promise<LanguagePreference> {
  const value = await getPreference(LANGUAGE_KEY);
  return value === 'pt' || value === 'en' ? value : 'system';
}

export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  await setPreference(LANGUAGE_KEY, preference);
}

/** The place the user picked last (where the next workout happens). */
export async function getCurrentLocationId(): Promise<string | null> {
  return getPreference(CURRENT_LOCATION_KEY);
}

export async function setCurrentLocationId(id: string): Promise<void> {
  await setPreference(CURRENT_LOCATION_KEY, id);
}

export async function getGoal(): Promise<Goal> {
  const parsed = GoalSchema.safeParse(await getPreference(GOAL_KEY));
  return parsed.success ? parsed.data : DEFAULT_GOAL;
}

export async function setGoal(goal: Goal): Promise<void> {
  await setPreference(GOAL_KEY, goal);
}

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'theme';

export async function getThemePreference(): Promise<ThemePreference> {
  const value = await getPreference(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  await setPreference(THEME_KEY, preference);
}

/** Show raw RIR numbers instead of plain words (for people who know the term). */
export async function getShowRir(): Promise<boolean> {
  return (await getPreference('showRir')) === '1';
}

export async function setShowRir(show: boolean): Promise<void> {
  await setPreference('showRir', show ? '1' : '0');
}

/** Whether the "how was it?" explanation was already shown and dismissed. */
export async function getEffortIntroSeen(): Promise<boolean> {
  return (await getPreference('effortIntroSeen')) === '1';
}

export async function setEffortIntroSeen(): Promise<void> {
  await setPreference('effortIntroSeen', '1');
}

/** A temporary place (travel): used instead of the usual one until a date. */
export type Travel = { locationId: string; until: string };

export async function getTravel(): Promise<Travel | null> {
  const value = await getPreference('travel');
  if (!value) return null;
  try {
    const travel = JSON.parse(value) as Travel;
    return travel.locationId && travel.until ? travel : null;
  } catch {
    return null;
  }
}

export async function setTravel(travel: Travel | null): Promise<void> {
  await setPreference('travel', travel ? JSON.stringify(travel) : '');
}

/** The user chose to train without a plan (skips the first-run guide). */
export async function getQuickStartSkipped(): Promise<boolean> {
  return (await getPreference('quickStartSkipped')) === '1';
}

export async function skipQuickStart(): Promise<void> {
  await setPreference('quickStartSkipped', '1');
}
