import { GOAL_CONFIG, type GoalConfig } from '../progression/config';
import type { MovementPattern } from '../training';
import type { Mesocycle, MesocycleRequest, Session, Slot, Week } from './schema';
import { AREA_EXTRA_SLOTS, AREA_PATTERNS, EXTRA_SLOT_SESSIONS, isMainPattern, SPLITS } from './templates';

/** Average time under tension + setup for one set, in seconds. */
const SECONDS_PER_SET = 40;
/** An added isolation slot for a prioritised area appears in at most this many sessions a week. */
const EXTRA_SLOTS_PER_WEEK = 2;
/** Warm-up and moving between exercises, in minutes. */
const OVERHEAD_MINUTES = 6;
const DELOAD_RIR = 4;

/**
 * Builds a mesocycle from templates — no AI (docs/decisoes.md §22).
 *
 * - Weeks: 3 (beginner) or 4 working weeks, then one deload week.
 * - Effort rises week by week (RIR goes down), then recovers in the deload.
 * - Hypertrophy (not beginners): one extra set on main slots in the second half.
 * - Prioritised body areas (the body map): +1 set a week on their patterns, an
 *   isolation slot added where useful, and they are the last thing cut for time.
 * - Each session is trimmed to fit the minutes available.
 */
export function generateMesocycle(request: MesocycleRequest): Mesocycle {
  const config = GOAL_CONFIG[request.goal];
  const split = SPLITS[request.daysPerWeek];
  if (!split) {
    throw new Error(`No split for ${request.daysPerWeek} days`);
  }

  const weeks = buildWeeks(request);
  const workWeeks = weeks.length - 1;
  const experienceDelta = request.experience === 'beginner' ? -1 : request.experience === 'advanced' ? 1 : 0;
  const baseMainSets = clamp(config.sets + experienceDelta, 2, 5);
  const baseIsolationSets = request.experience === 'advanced' ? 3 : 2;
  const rampVolume = request.goal === 'hypertrophy' && request.experience !== 'beginner';

  const priorityAreas = request.priorityAreas ?? [];
  const priorityPatterns = new Set(priorityAreas.flatMap((area) => AREA_PATTERNS[area]));

  function setsPerWeek(main: boolean, priority: boolean): number[] {
    const base = main ? baseMainSets : baseIsolationSets;
    return weeks.map((week, index) => {
      if (week.deload) return Math.max(1, Math.ceil(base / 2));
      const ramp = rampVolume && main && index >= Math.ceil(workWeeks / 2) ? 1 : 0;
      return Math.min(6, base + ramp + (priority ? 1 : 0));
    });
  }

  // Which sessions get an extra isolation slot for a prioritised area.
  const extraSlots: MovementPattern[][] = split.map(() => []);
  for (const area of priorityAreas) {
    for (const pattern of AREA_EXTRA_SLOTS[area] ?? []) {
      const fits = split
        .map((session, index) => ({ session, index }))
        .filter(({ session }) => !session.patterns.includes(pattern))
        .filter(({ session }) => EXTRA_SLOT_SESSIONS[pattern]?.includes(session.focus));
      const alreadyInPlan = split.filter((session) => session.patterns.includes(pattern)).length;
      fits
        .slice(0, Math.max(0, EXTRA_SLOTS_PER_WEEK - alreadyInPlan))
        .forEach(({ index }) => extraSlots[index].push(pattern));
    }
  }

  const sessions: Session[] = split.map((template, sessionIndex) => {
    const key = String.fromCharCode(65 + sessionIndex); // A, B, C…
    const patterns = [...template.patterns, ...extraSlots[sessionIndex]];
    const slots: Slot[] = patterns.map((pattern, slotIndex) => {
      // Slots added for a prioritised area are extras: they may be cut for time (last).
      const added = slotIndex >= template.patterns.length;
      const main = isMainPattern(pattern) && !added;
      const priority = priorityPatterns.has(pattern);
      // Isolation work uses lighter loads, so a slightly higher rep range.
      const repMin = main ? config.repMin : Math.max(config.repMin + 2, 8);
      const repMax = main ? config.repMax : Math.min(Math.max(config.repMax + 3, 12), 30);
      return {
        id: `${key}${slotIndex + 1}`,
        pattern,
        main,
        repMin,
        repMax,
        setsPerWeek: setsPerWeek(main, priority),
        ...(priority ? { priority: true } : {}),
      };
    });
    return {
      key,
      focus: template.focus,
      slots: fitToTime(slots, request.sessionMinutes, config.restSeconds),
    };
  });

  return {
    goal: request.goal,
    experience: request.experience,
    daysPerWeek: request.daysPerWeek,
    sessionMinutes: request.sessionMinutes,
    restSeconds: config.restSeconds,
    weeks,
    sessions,
    ...(priorityAreas.length ? { priorityAreas } : {}),
  };
}

/** RIR from easier to harder across the working weeks, then a deload. */
function buildWeeks({ goal, experience }: MesocycleRequest): Week[] {
  const config = GOAL_CONFIG[goal];
  const workWeeks = experience === 'beginner' ? 3 : 4;
  const start = Math.min(config.targetRir + 1, 4);
  // General health never goes close to failure.
  const end = goal === 'general_health' ? config.targetRir : Math.max(config.targetRir - 1, 1);

  const weeks: Week[] = Array.from({ length: workWeeks }, (_, index) => ({
    rir: Math.round(start + ((end - start) * index) / (workWeeks - 1)),
    deload: false,
  }));
  weeks.push({ rir: DELOAD_RIR, deload: true });
  return weeks;
}

/** Estimated minutes for a session in its heaviest week. */
export function estimateMinutes(slots: Slot[], restSeconds: number): number {
  const sets = slots.reduce((total, slot) => total + Math.max(...slot.setsPerWeek), 0);
  return OVERHEAD_MINUTES + (sets * (SECONDS_PER_SET + restSeconds)) / 60;
}

/**
 * Trims a session to the time available, cutting what matters least first:
 * 1. isolation slots that aren't a priority (last first);
 * 2. sets from main slots that aren't a priority (last first, min 2);
 * 3. prioritised isolation slots;
 * 4. sets from prioritised main slots (min 2).
 * What the user chose to improve is always the last thing to go.
 */
export function fitToTime(slots: Slot[], minutes: number, restSeconds: number): Slot[] {
  let result = slots.map((slot) => ({ ...slot, setsPerWeek: [...slot.setsPerWeek] }));

  const dropIsolation = (priority: boolean) => {
    const index = result.map((slot) => !slot.main && Boolean(slot.priority) === priority).lastIndexOf(true);
    if (index === -1) return false;
    result = result.filter((_, i) => i !== index);
    return true;
  };
  const reduceMain = (priority: boolean) => {
    const slot = [...result]
      .reverse()
      .find((item) => item.main && Boolean(item.priority) === priority && Math.max(...item.setsPerWeek) > 2);
    if (!slot) return false;
    slot.setsPerWeek = slot.setsPerWeek.map((sets) => Math.max(sets === 1 ? 1 : 2, sets - 1));
    return true;
  };
  const steps = [
    () => dropIsolation(false),
    () => reduceMain(false),
    () => dropIsolation(true),
    () => reduceMain(true),
  ];

  while (estimateMinutes(result, restSeconds) > minutes) {
    if (!steps.some((step) => step())) break; // Can't go lower without losing the point of the session.
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The progression engine's settings for one slot in one week of a plan:
 * the plan decides reps, sets, effort and rest; the goal decides the levers.
 */
export function slotProgressionConfig(plan: Mesocycle, slot: Slot, weekIndex: number): GoalConfig {
  const base = GOAL_CONFIG[plan.goal];
  return {
    ...base,
    repMin: slot.repMin,
    repMax: slot.repMax,
    repCeiling: Math.max(base.repCeiling, slot.repMax),
    sets: slot.setsPerWeek[weekIndex] ?? slot.setsPerWeek[slot.setsPerWeek.length - 1],
    targetRir: plan.weeks[weekIndex]?.rir ?? base.targetRir,
    restSeconds: plan.restSeconds,
  };
}
