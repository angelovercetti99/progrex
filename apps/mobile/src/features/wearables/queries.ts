import { summarizeHeartRate, type HeartRateSummary } from '@progrex/shared';

import type { Workout } from '@/db/schema';
import { getPreference, setPreference } from '@/lib/preferences';

import { healthPlatform } from './platform';

/**
 * Apple Health / Health Connect (docs/decisoes.md §51). Off until the user
 * turns it on in Settings: it's this device's choice, so it's a local
 * preference. Every call fails silently: a watch must never get in the way
 * of logging a workout.
 */

const KEY = 'healthSync';

export async function getHealthSyncEnabled(): Promise<boolean> {
  return healthPlatform !== null && (await getPreference(KEY)) === '1';
}

/** Turning it on shows the system's permission screen; off just stops using it. */
export async function setHealthSyncEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await setPreference(KEY, '0');
    return true;
  }
  const granted = (await healthPlatform?.connect().catch(() => false)) ?? false;
  await setPreference(KEY, granted ? '1' : '0');
  return granted;
}

/** After finishing: the workout goes to Apple Health / Health Connect (rings, daily activity). */
export async function exportWorkout(workout: Workout, title: string): Promise<void> {
  if (!workout.finishedAt || !(await getHealthSyncEnabled())) return;
  try {
    await healthPlatform?.saveWorkout({
      start: new Date(workout.startedAt),
      end: new Date(workout.finishedAt),
      title,
    });
  } catch {
    // Silent: the workout is safe in Progrex either way.
  }
}

/** Average and maximum heart rate the watch recorded during the workout. */
export async function getWorkoutHeartRate(workout: Workout): Promise<HeartRateSummary | null> {
  if (!workout.finishedAt || !(await getHealthSyncEnabled())) return null;
  try {
    const samples =
      (await healthPlatform?.heartRate(new Date(workout.startedAt), new Date(workout.finishedAt))) ?? [];
    return summarizeHeartRate(samples, workout.startedAt, workout.finishedAt);
  } catch {
    return null;
  }
}
