import { useTranslation } from 'react-i18next';

import { useLiveQuery } from '@/db/live';
import { PlanOverview } from '@/features/plan/PlanOverview';
import { PlanSetup } from '@/features/plan/PlanSetup';
import { getPlanState } from '@/features/plan/queries';
import { DEFAULT_GOAL, getGoal } from '@/lib/preferences';
import { Screen } from '@/ui/Screen';

export default function PlanScreen() {
  const { t } = useTranslation();
  const state = useLiveQuery(getPlanState, ['mesocycles', 'workouts'], []);
  const goal = useLiveQuery(getGoal, ['preferences'], []);

  return (
    <Screen title={t('plan.title')}>
      {state.status === 'ready' &&
        goal.status === 'ready' &&
        (state.data ? (
          <PlanOverview state={state.data} />
        ) : (
          <PlanSetup initialGoal={goal.data ?? DEFAULT_GOAL} />
        ))}
    </Screen>
  );
}
