import {
  addDays,
  builtinExerciseId,
  CATALOG,
  weekStart,
  type LocationEquipment,
  type Target,
} from '@progrex/shared';
import { and, isNotNull, isNull, like } from 'drizzle-orm';

import { db } from '@/db/client';
import { notifyChanged } from '@/db/live';
import { locations, sets, workoutExercises, workouts } from '@/db/schema';
import { nowIso, todayLocalDate } from '@/db/stamps';
import { getCurrentLocationId, getTravel, setCurrentLocationId, setTravel } from '@/lib/preferences';

/**
 * Sample data so the Progress screen can be explored before 8 weeks of
 * training exist: gym weeks, a week at home and a hotel trip.
 *
 * Every id starts with `demo:`. These rows are never synced (dirty = false)
 * and are the ONLY rows we ever hard-delete — real data is soft-deleted.
 */
const PREFIX = 'demo:';

type Place = 'gym' | 'home' | 'hotel';

const PLACES: Record<Place, { name: string; equipment: LocationEquipment }> = {
  gym: {
    name: 'Ginásio',
    equipment: [
      'dumbbells',
      'barbell',
      'squat_rack',
      'bench',
      'pull_up_bar',
      'cable_machine',
      'machines',
    ].map((type) => ({ type }) as LocationEquipment[number]),
  },
  home: {
    name: 'Casa',
    equipment: [{ type: 'dumbbells', maxKg: 20 }, { type: 'bands' }, { type: 'pull_up_bar' }],
  },
  hotel: { name: 'Hotel Lisboa', equipment: [] },
};

/** Which exercise each place uses for each slot of sessions A and B. */
const SESSIONS: Record<Place, [string[], string[]]> = {
  gym: [
    ['dumbbell_bench_press', 'barbell_row', 'back_squat', 'cable_crunch'],
    ['dumbbell_shoulder_press', 'chin_up', 'barbell_rdl', 'cable_crunch'],
  ],
  home: [
    ['dumbbell_floor_press', 'dumbbell_row', 'goblet_squat', 'dead_bug'],
    ['dumbbell_shoulder_press', 'chin_up', 'dumbbell_rdl', 'dead_bug'],
  ],
  hotel: [
    ['decline_push_up', 'table_row', 'bulgarian_split_squat', 'dead_bug'],
    ['pike_push_up', 'towel_door_row', 'single_leg_rdl', 'dead_bug'],
  ],
};

const START_WEIGHT: Record<string, number> = {
  dumbbell_bench_press: 22,
  barbell_row: 40,
  back_squat: 60,
  cable_crunch: 20,
  dumbbell_shoulder_press: 14,
  barbell_rdl: 60,
  dumbbell_floor_press: 18,
  dumbbell_row: 18,
  goblet_squat: 16,
  dumbbell_rdl: 16,
};

/** 8 weeks, oldest first. The current week is the hotel trip. */
const WEEKS: Place[] = ['gym', 'gym', 'gym', 'home', 'gym', 'gym', 'gym', 'hotel'];
const DAYS = [0, 2, 4]; // Monday, Wednesday, Friday

export async function hasDemoData(): Promise<boolean> {
  return (
    (await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(like(workouts.id, `${PREFIX}%`))
      .get()) !== undefined
  );
}

export async function hasRealWorkouts(): Promise<boolean> {
  const row = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(isNotNull(workouts.finishedAt), isNull(workouts.deletedAt)))
    .get();
  return row !== undefined && !row.id.startsWith(PREFIX);
}

export async function createDemoData(): Promise<void> {
  const now = nowIso();
  const stamps = { createdAt: now, updatedAt: now, dirty: false };
  const today = todayLocalDate();
  const firstMonday = addDays(weekStart(today), -7 * (WEEKS.length - 1));
  const catalog = new Map(CATALOG.map((exercise) => [exercise.key, exercise]));

  await db.insert(locations).values(
    (Object.keys(PLACES) as Place[]).map((place) => ({
      id: `${PREFIX}${place}`,
      name: PLACES[place].name,
      equipment: PLACES[place].equipment,
      ...stamps,
    }))
  );

  // Double progression per exercise: +1 rep per session, then +weight back to 8 reps.
  const state = new Map<string, { weight: number | null; reps: number }>();
  const done = new Map<string, number>();
  // `$inferInsert`: the row shape Drizzle derives from the schema for inserts.
  const workoutRows: (typeof workouts.$inferInsert)[] = [];
  const itemRows: (typeof workoutExercises.$inferInsert)[] = [];
  const setRows: (typeof sets.$inferInsert)[] = [];
  let sessionIndex = 0;

  for (let week = 0; week < WEEKS.length; week++) {
    const place = WEEKS[week];
    for (const day of DAYS) {
      const date = addDays(firstMonday, 7 * week + day);
      if (date > today) continue;
      const workoutId = `${PREFIX}w${week}-${day}`;
      // Morning sessions: never later than a workout you log today.
      const startedAt = `${date}T07:00:00.000Z`;
      workoutRows.push({
        id: workoutId,
        date,
        locationId: `${PREFIX}${place}`,
        startedAt,
        finishedAt: `${date}T07:45:00.000Z`,
        notes: 'demo',
        ...stamps,
      });

      SESSIONS[place][sessionIndex % 2].forEach((key, position) => {
        const exercise = catalog.get(key)!;
        const loaded = exercise.loadType === 'external';
        const previous = state.get(key);
        // Realistic pace: progress every second session, repeat in between.
        const times = (done.get(key) ?? 0) + 1;
        done.set(key, times);
        const progresses = previous !== undefined && times % 2 === 1;
        let lever: Target['lever'] = previous ? (progresses ? 'reps' : 'complete_sets') : 'calibrate';
        let next = previous
          ? { ...previous, reps: previous.reps + (progresses ? 1 : 0) }
          : { weight: START_WEIGHT[key] ?? null, reps: loaded ? 8 : 10 };
        if (progresses && previous && loaded && previous.reps >= 12) {
          next = { weight: (previous.weight ?? 0) + exercise.loadIncrementKg, reps: 8 };
          lever = 'load';
        } else if (progresses && previous && !loaded && previous.reps >= 15) {
          next = { ...previous, reps: previous.reps }; // reps capped: rest becomes the lever
          lever = 'rest';
        }
        state.set(key, next);

        const itemId = `${PREFIX}${workoutId}-${position}`;
        itemRows.push({
          id: itemId,
          workoutId,
          exerciseId: builtinExerciseId(key),
          position: position + 1,
          target: { lever, sets: [], restSeconds: 90, tempoEccentricSeconds: null, focusSet: null } as Target,
          ...stamps,
        });
        [0, 1, 2].forEach((setIndex) => {
          setRows.push({
            id: `${itemId}-${setIndex}`,
            workoutExerciseId: itemId,
            position: setIndex + 1,
            reps: Math.max(1, next.reps - (setIndex === 0 ? 0 : 1)),
            weightKg: loaded ? next.weight : null,
            rir: 2,
            restSeconds: setIndex === 0 ? null : 90,
            completedAt: startedAt,
            ...stamps,
          });
        });
      });
      sessionIndex++;
    }
  }

  // Small batches keep each SQL statement short.
  for (let i = 0; i < workoutRows.length; i += 20)
    await db.insert(workouts).values(workoutRows.slice(i, i + 20));
  for (let i = 0; i < itemRows.length; i += 20)
    await db.insert(workoutExercises).values(itemRows.slice(i, i + 20));
  for (let i = 0; i < setRows.length; i += 30) await db.insert(sets).values(setRows.slice(i, i + 30));

  // With no places of your own, show the trip: gym as usual place, hotel until Sunday.
  if (!(await getCurrentLocationId())) {
    await setCurrentLocationId(`${PREFIX}gym`);
    await setTravel({ locationId: `${PREFIX}hotel`, until: addDays(weekStart(today), 6) });
  }
  notifyChanged('locations', 'workouts', 'workout_exercises', 'sets');
}

export async function deleteDemoData(): Promise<void> {
  await db.delete(sets).where(like(sets.id, `${PREFIX}%`));
  await db.delete(workoutExercises).where(like(workoutExercises.id, `${PREFIX}%`));
  await db.delete(workouts).where(like(workouts.id, `${PREFIX}%`));
  await db.delete(locations).where(like(locations.id, `${PREFIX}%`));
  if ((await getTravel())?.locationId.startsWith(PREFIX)) {
    await setTravel(null);
  }
  const current = await getCurrentLocationId();
  if (current?.startsWith(PREFIX)) {
    const other = await db
      .select({ id: locations.id })
      .from(locations)
      .where(isNull(locations.deletedAt))
      .get();
    if (other) await setCurrentLocationId(other.id);
  }
  notifyChanged('locations', 'workouts', 'workout_exercises', 'sets', 'preferences');
}
