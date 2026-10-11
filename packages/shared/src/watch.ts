import { z } from 'zod';

/**
 * What the phone and the Apple Watch say to each other (docs/decisoes.md §52).
 *
 * The phone does all the thinking (targets, words, numbers): the watch only
 * shows the current set and sends "done". So the watch app stays tiny and
 * every rule lives in one place. Texts arrive already translated.
 *
 * WatchConnectivity only accepts property-list values (no null), so each
 * message travels as one JSON string under a single key.
 */

export const WATCH_PROTOCOL = 1;

export const WatchStateSchema = z.object({
  v: z.literal(WATCH_PROTOCOL),
  workoutId: z.string(),
  /** The exercise being done (workout_exercises.id). */
  itemId: z.string(),
  /** The set to do now, from 1. */
  setNumber: z.number().int().min(1),
  /** Exercise name. */
  title: z.string(),
  /** "Set 2 of 4". */
  subtitle: z.string(),
  /** "22.5 kg × 10" or "× 12". */
  target: z.string(),
  /** Button label: "Complete set". */
  action: z.string(),
  /** "Rest". */
  restLabel: z.string(),
  /** When the last set was completed (ISO), to count the rest. */
  restSince: z.string().nullable(),
  restSeconds: z.number().int().nullable(),
  /** Every planned set is done: finish on the phone. */
  done: z.boolean(),
  doneLabel: z.string(),
});
export type WatchState = z.infer<typeof WatchStateSchema>;

export const WatchCommandSchema = z.object({
  v: z.literal(WATCH_PROTOCOL),
  type: z.literal('complete_set'),
  workoutId: z.string(),
  itemId: z.string(),
  /** Which set the watch was showing: a repeated tap can't log it twice. */
  setNumber: z.number().int().min(1),
});
export type WatchCommand = z.infer<typeof WatchCommandSchema>;

/** Key of the JSON string in the application context (phone → watch). */
export const WATCH_STATE_KEY = 'state';
/** Key of the JSON string in a message (watch → phone). */
export const WATCH_COMMAND_KEY = 'command';

/** null = no workout in progress (an empty string, since null can't travel). */
export function encodeWatchState(state: WatchState | null): Record<string, string> {
  return { [WATCH_STATE_KEY]: state ? JSON.stringify(state) : '' };
}

/** A message from the watch, or null if it isn't one we understand (old version, garbage). */
export function decodeWatchCommand(payload: Record<string, unknown>): WatchCommand | null {
  const raw = payload[WATCH_COMMAND_KEY];
  if (typeof raw !== 'string') return null;
  try {
    const parsed = WatchCommandSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Should the phone log this set? Only if the watch was showing the set that
 * is actually next: a tap that arrives twice, or late, changes nothing.
 */
export function acceptsCommand(command: WatchCommand, workoutId: string, setsDone: number): boolean {
  return command.workoutId === workoutId && command.setNumber === setsDone + 1;
}
