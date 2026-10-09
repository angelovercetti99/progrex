import type { MovementPattern } from '../training';
import { estimateMinutes } from './generate';
import { MesocycleSchema, type Mesocycle } from './schema';

/**
 * Domain rules a mesocycle must follow, whoever made it (templates now, AI
 * later). The schema checks the SHAPE; this checks that it makes SENSE.
 * Returns a list of problems — empty means valid.
 */
export function validateMesocycle(input: unknown): string[] {
  const parsed = MesocycleSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `schema: ${issue.path.join('.')} ${issue.message}`);
  }
  const plan: Mesocycle = parsed.data;
  const problems: string[] = [];

  const deloads = plan.weeks.filter((week) => week.deload).length;
  if (deloads !== 1 || !plan.weeks[plan.weeks.length - 1].deload) {
    problems.push('weeks: exactly one deload week, at the end');
  }

  const slots = plan.sessions.flatMap((session) => session.slots);
  const ids = slots.map((slot) => slot.id);
  if (new Set(ids).size !== ids.length) {
    problems.push('slots: ids must be unique');
  }
  for (const slot of slots) {
    if (slot.setsPerWeek.length !== plan.weeks.length)
      problems.push(`slot ${slot.id}: one set count per week`);
    if (slot.repMin > slot.repMax) problems.push(`slot ${slot.id}: repMin above repMax`);
  }

  // Every week must train the whole body: push, pull, knee- and hip-dominant legs.
  const patterns = new Set<MovementPattern>(slots.map((slot) => slot.pattern));
  const has = (...options: MovementPattern[]) => options.some((pattern) => patterns.has(pattern));
  if (!has('horizontal_push', 'vertical_push')) problems.push('coverage: no push');
  if (!has('horizontal_pull', 'vertical_pull')) problems.push('coverage: no pull');
  if (!has('squat', 'lunge')) problems.push('coverage: no squat or lunge');
  if (!has('hinge')) problems.push('coverage: no hinge');

  // Weekly sets per pattern within a sane maximum (more isn't better).
  plan.weeks.forEach((_, weekIndex) => {
    const perPattern = new Map<MovementPattern, number>();
    for (const slot of slots) {
      perPattern.set(slot.pattern, (perPattern.get(slot.pattern) ?? 0) + slot.setsPerWeek[weekIndex]);
    }
    for (const [pattern, sets] of perPattern) {
      if (sets > 20) problems.push(`volume: ${pattern} has ${sets} sets in week ${weekIndex + 1}`);
    }
  });

  for (const session of plan.sessions) {
    if (estimateMinutes(session.slots, plan.restSeconds) > plan.sessionMinutes + 10) {
      problems.push(`session ${session.key}: does not fit in ${plan.sessionMinutes} minutes`);
    }
  }

  return problems;
}
