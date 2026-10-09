import { GOAL_CONFIG, type Goal, type Target } from '@progrex/shared';
import { useTranslation } from 'react-i18next';

import { formatNumber } from '@/ui/Stepper';

/** Turns the engine's decision into one plain sentence: what to do today. */
export function useTargetMessage() {
  const { t } = useTranslation();

  return (target: Target, goal: Goal, usesLoad: boolean, harderName: string | null): string => {
    const config = GOAL_CONFIG[goal];
    const first = target.sets[0];
    switch (target.lever) {
      case 'calibrate':
        return t(usesLoad ? 'progression.calibrate' : 'progression.calibrateNoLoad', {
          min: config.repMin,
          max: config.repMax,
          rir: config.targetRir,
        });
      case 'reps': {
        const index = target.focusSet ?? 0;
        return t('progression.reps', { reps: target.sets[index].reps, set: index + 1 });
      }
      case 'load':
      case 'load_down':
        return t(`progression.${target.lever}`, { weight: formatNumber(first.weightKg ?? 0) });
      case 'rest':
        return t('progression.rest', { rest: target.restSeconds });
      case 'tempo':
        return t('progression.tempo', { seconds: target.tempoEccentricSeconds ?? 3 });
      case 'sets':
      case 'complete_sets':
        return t(`progression.${target.lever}`, { sets: target.sets.length });
      case 'deload':
        return t('progression.deload');
      case 'variant':
        return harderName ? t('progression.variant', { exercise: harderName }) : t('progression.variantNone');
    }
  };
}
