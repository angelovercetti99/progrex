import { useTranslation } from 'react-i18next';

import type { Exercise } from '@/db/schema';

/** Built-ins are translated; custom exercises show the name the user typed. */
export function useExerciseName() {
  const { t } = useTranslation();
  return (exercise: Pick<Exercise, 'name' | 'nameKey'>): string => {
    if (exercise.nameKey) {
      // The key comes from the database, so TypeScript can't check it here.
      return t(`exercises.${exercise.nameKey}` as 'exercises.push_up');
    }
    return exercise.name ?? '';
  };
}
