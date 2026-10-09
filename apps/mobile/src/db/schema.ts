import type {
  EquipmentType,
  LoadType,
  LocationEquipment,
  Mesocycle,
  MovementPattern,
  Target,
} from '@progrex/shared';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Database tables, written in TypeScript. `drizzle-kit generate` turns changes
 * here into SQL migration files (src/db/migrations). Never edit a migration
 * that has already run — change this file and generate a new one.
 */

/**
 * Columns every synced table has (see docs/decisoes.md §6–8):
 * - timestamps in ISO 8601 UTC
 * - `deletedAt`: soft delete ("tombstone"), rows are never really removed
 * - `dirty`: changed locally and not yet sent to the server
 */
const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
};

/** Small local settings (language…). Not synced. */
export const preferences = sqliteTable('preferences', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Exercise catalog: built-in (seeded from code) + the user's own. */
export const exercises = sqliteTable('exercises', {
  /** Built-ins have stable ids like `builtin:push_up`; custom ones get a UUIDv7. */
  id: text('id').primaryKey(),
  /** Custom exercises: the name the user typed. */
  name: text('name'),
  /** Built-ins: translated via i18n (`exercises.<nameKey>`). */
  nameKey: text('name_key'),
  pattern: text('pattern').$type<MovementPattern>().notNull(),
  /** ALL of these are needed. Empty = bodyweight only. */
  equipment: text('equipment', { mode: 'json' }).$type<EquipmentType[]>().notNull(),
  loadType: text('load_type').$type<LoadType>().notNull(),
  /** 1 (easiest) to 5 (hardest), compared only within the same pattern. */
  difficulty: integer('difficulty').notNull(),
  /** Smallest sensible weight jump, in kg. */
  loadIncrementKg: real('load_increment_kg').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

/** Places where the user trains, with their equipment checklist. */
export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  equipment: text('equipment', { mode: 'json' }).$type<LocationEquipment>().notNull(),
  ...syncColumns,
});

/** A training block (4–6 weeks). Only one is `active` at a time. */
export const mesocycles = sqliteTable('mesocycles', {
  id: text('id').primaryKey(),
  /** Local calendar date it started, `YYYY-MM-DD`. */
  startDate: text('start_date').notNull(),
  status: text('status').$type<'active' | 'completed' | 'abandoned'>().notNull(),
  /** The whole plan, validated by MesocycleSchema + validateMesocycle. */
  plan: text('plan', { mode: 'json' }).$type<Mesocycle>().notNull(),
  ...syncColumns,
});

export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    /** Local calendar date, `YYYY-MM-DD`. */
    date: text('date').notNull(),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id),
    startedAt: text('started_at').notNull(),
    /** null = workout still in progress. */
    finishedAt: text('finished_at'),
    /** Set when the workout follows a plan: which block, week and session. */
    mesocycleId: text('mesocycle_id').references(() => mesocycles.id),
    planWeek: integer('plan_week'),
    planSession: integer('plan_session'),
    notes: text('notes'),
    ...syncColumns,
  },
  (table) => [index('workouts_date_idx').on(table.date)]
);

/** "In this workout, exercise X was done in position N." */
export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    position: integer('position').notNull(),
    /** The plan slot this exercise fills (e.g. "A1"), if any. */
    slotId: text('slot_id'),
    /** What the progression engine prescribed when the exercise was added. */
    target: text('target', { mode: 'json' }).$type<Target>(),
    ...syncColumns,
  },
  (table) => [index('workout_exercises_workout_idx').on(table.workoutId)]
);

export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id')
      .notNull()
      .references(() => workoutExercises.id),
    position: integer('position').notNull(),
    reps: integer('reps').notNull(),
    /** Always kg. null = no added load (bodyweight). */
    weightKg: real('weight_kg'),
    /** Reps in reserve (0–5). */
    rir: integer('rir'),
    /** Rest taken before this set, measured automatically. */
    restSeconds: integer('rest_seconds'),
    /** null = planned but not done yet. */
    completedAt: text('completed_at'),
    ...syncColumns,
  },
  (table) => [index('sets_workout_exercise_idx').on(table.workoutExerciseId)]
);

export type Exercise = typeof exercises.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type MesocycleRow = typeof mesocycles.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof sets.$inferSelect;
