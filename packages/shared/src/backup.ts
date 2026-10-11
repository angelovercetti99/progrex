import { z } from 'zod';

import type { Target } from './progression/engine';
import { MesocycleSchema } from './plan/schema';
import {
  EquipmentTypeSchema,
  LoadTypeSchema,
  LocationEquipmentSchema,
  MovementPatternSchema,
  RirSchema,
} from './training';

/**
 * Backup file: every row of your training in one JSON file, to keep somewhere
 * safe or move to another device (docs/decisoes.md §48).
 *
 * The file is untrusted input (it could be edited or come from an older app),
 * so it is checked with Zod before anything is written. Unknown fields are
 * dropped, missing optional fields become null.
 */

export const BACKUP_VERSION = 1;

/** A column that may be missing or null in the file: stored as null. */
const optional = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().default(null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.string().min(10);
const id = z.string().min(1);

/** Columns every synced table has. `dirty` is local only and never exported. */
const syncFields = {
  id,
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: optional(timestamp),
};

/** JSON blobs written by our own code: only checked to be an object. */
const jsonObject = <T>() => z.custom<T>((value) => typeof value === 'object' && value !== null);

const ExerciseRowSchema = z.object({
  ...syncFields,
  name: optional(z.string()),
  nameKey: optional(z.string()),
  pattern: MovementPatternSchema,
  equipment: z.array(EquipmentTypeSchema),
  loadType: LoadTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  loadIncrementKg: z.number().nonnegative(),
});

const LocationRowSchema = z.object({
  ...syncFields,
  name: z.string(),
  equipment: LocationEquipmentSchema,
});

const MesocycleRowSchema = z.object({
  ...syncFields,
  startDate: isoDate,
  status: z.enum(['active', 'completed', 'abandoned']),
  plan: MesocycleSchema,
});

const WorkoutRowSchema = z.object({
  ...syncFields,
  date: isoDate,
  locationId: id,
  startedAt: timestamp,
  finishedAt: optional(timestamp),
  mesocycleId: optional(id),
  planWeek: optional(z.number().int().nonnegative()),
  planSession: optional(z.number().int().nonnegative()),
  planSessionsCovered: optional(z.array(z.number().int().nonnegative())),
  conditions: optional(jsonObject<Record<string, unknown>>()),
  notes: optional(z.string()),
});

const WorkoutExerciseRowSchema = z.object({
  ...syncFields,
  workoutId: id,
  exerciseId: id,
  position: z.number().int(),
  slotId: optional(z.string()),
  target: optional(jsonObject<Target>()),
});

const SetRowSchema = z.object({
  ...syncFields,
  workoutExerciseId: id,
  position: z.number().int(),
  reps: z.number().int().nonnegative(),
  weightKg: optional(z.number().nonnegative()),
  rir: optional(RirSchema),
  restSeconds: optional(z.number().int().nonnegative()),
  completedAt: optional(timestamp),
});

export const BackupSchema = z.object({
  app: z.literal('progrex'),
  /** Files from a newer app are refused: they may hold data we would lose. */
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: timestamp,
  /** Parent tables first, so a restore can insert them in this order. */
  tables: z.object({
    exercises: z.array(ExerciseRowSchema),
    locations: z.array(LocationRowSchema),
    mesocycles: z.array(MesocycleRowSchema),
    workouts: z.array(WorkoutRowSchema),
    workoutExercises: z.array(WorkoutExerciseRowSchema),
    sets: z.array(SetRowSchema),
  }),
  /** A few settings (goal, places…). Restored only where this device has none. */
  preferences: z.record(z.string(), z.string()).default({}),
});
export type Backup = z.infer<typeof BackupSchema>;
export type BackupTables = Backup['tables'];
export type BackupTable = keyof BackupTables;

/** Insert order: a row's parent is always written before it. */
export const BACKUP_TABLES: BackupTable[] = [
  'exercises',
  'locations',
  'mesocycles',
  'workouts',
  'workoutExercises',
  'sets',
];

/**
 * Reads a backup file. Returns `null` when it is not a Progrex backup we can
 * use (not JSON, wrong shape, or made by a newer version of the app).
 */
export function parseBackup(text: string): Backup | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = BackupSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

type Versioned = { id: string; updatedAt: string };

/**
 * Which rows of the file to write: the ones this device doesn't have, or has
 * an older version of. Same rule as sync (last write wins, docs/decisoes.md §8),
 * so restoring twice changes nothing and never overwrites newer work.
 */
export function rowsToRestore<T extends Versioned>(local: Versioned[], incoming: T[]): T[] {
  const localUpdatedAt = new Map(local.map((row) => [row.id, row.updatedAt]));
  return incoming.filter((row) => {
    const current = localUpdatedAt.get(row.id);
    return current === undefined || row.updatedAt > current;
  });
}

type MesocycleStatusRow = { id: string; startDate: string; updatedAt: string; status: string };

/**
 * Only one plan can be active. After merging two devices there may be more:
 * the one started last stays, the others are returned (to mark as abandoned).
 */
export function extraActiveMesocycles(rows: MesocycleStatusRow[]): string[] {
  const active = rows
    .filter((row) => row.status === 'active')
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.updatedAt.localeCompare(a.updatedAt));
  return active.slice(1).map((row) => row.id);
}
