import type { Mesocycle, MesocycleRequest } from './schema';

/** Completed blocks after which a beginner is treated as intermediate (~3–4 months). */
export const BLOCKS_TO_INTERMEDIATE = 3;

/**
 * The next block, from the one just finished: the same choices, so starting it
 * is one tap. A beginner who has completed a few blocks moves up a level
 * (harder starting variants, a fourth working week). Advanced is never assumed.
 */
export function nextMesocycleRequest(
  previous: Mesocycle,
  completedBlocks: number,
  startDate: string
): MesocycleRequest {
  const experience =
    previous.experience === 'beginner' && completedBlocks >= BLOCKS_TO_INTERMEDIATE
      ? 'intermediate'
      : previous.experience;
  return {
    goal: previous.goal,
    experience,
    daysPerWeek: previous.daysPerWeek,
    sessionMinutes: previous.sessionMinutes,
    priorityAreas: previous.priorityAreas ?? [],
    health: previous.health,
    startDate,
  };
}
