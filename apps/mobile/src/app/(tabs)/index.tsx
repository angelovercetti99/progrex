import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { getActiveTravel, getCurrentLocation } from '@/features/locations/queries';
import { TravelBanner } from '@/features/locations/TravelBanner';
import { useEquipmentSummary } from '@/features/locations/useEquipmentSummary';
import { QuickStart } from '@/features/onboarding/QuickStart';
import { NextSession } from '@/features/plan/NextSession';
import { getPlanState } from '@/features/plan/queries';
import { getActiveWorkout, hasFinishedWorkout, startWorkout } from '@/features/workouts/queries';
import { getQuickStartSkipped } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { Logo } from '@/ui/Logo';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';

export default function TodayScreen() {
  const { t } = useTranslation();
  const summarize = useEquipmentSummary();
  const active = useLiveQuery(getActiveWorkout, ['workouts', 'workout_exercises'], []);
  const location = useLiveQuery(getCurrentLocation, ['locations', 'preferences'], []);
  const plan = useLiveQuery(getPlanState, ['mesocycles', 'workouts'], []);
  const travel = useLiveQuery(getActiveTravel, ['preferences', 'locations'], []).data ?? null;
  const trained = useLiveQuery(hasFinishedWorkout, ['workouts'], []);
  const skipped = useLiveQuery(getQuickStartSkipped, ['preferences'], []);

  if (
    active.status !== 'ready' ||
    location.status !== 'ready' ||
    plan.status !== 'ready' ||
    trained.status !== 'ready' ||
    skipped.status !== 'ready'
  ) {
    return (
      <Screen title={t('today.title')} header={<Logo size={30} />}>
        {null}
      </Screen>
    );
  }

  // 1. A workout is already in progress: one thing to do, continue it.
  if (active.data) {
    const workout = active.data;
    return (
      <Screen title={t('today.title')} header={<Logo size={30} />}>
        <View style={styles.center}>
          <Text variant="heading" align="center">
            {t('today.inProgress')}
          </Text>
          <Text color="textMuted" align="center">
            {t('today.exerciseCount', { count: workout.exerciseCount })}
          </Text>
          <View style={styles.actions}>
            <Button label={t('today.continue')} onPress={() => router.push(`/workout/${workout.id}`)} />
          </View>
        </View>
      </Screen>
    );
  }

  // 2. First run (no plan, never trained): three taps (where, goal, days) and the plan is ready.
  if (!location.data || (!plan.data && !trained.data && !skipped.data)) {
    return (
      <Screen title={t('today.title')} header={<Logo size={30} />}>
        <QuickStart hasPlace={Boolean(location.data)} />
      </Screen>
    );
  }

  const current = location.data;

  // 3. Following a plan: the next session, adapted to this place.
  if (plan.data?.next) {
    return (
      <Screen title={t('today.title')} header={<Logo size={30} />}>
        <NextSession state={plan.data} next={plan.data.next} location={current} />
      </Screen>
    );
  }

  // 4. No plan (or plan finished): free workout.
  async function startFree() {
    const id = await startWorkout(current.id);
    router.push(`/workout/${id}`);
  }

  return (
    <Screen title={t('today.title')} header={<Logo size={30} />}>
      {travel && <TravelBanner travel={travel} />}
      <View style={styles.center}>
        <Text variant="heading" align="center">
          {plan.data ? t('plan.completeTitle') : t('today.readyTitle')}
        </Text>
        {plan.data && (
          <Text color="textMuted" align="center">
            {t('plan.completeDescription')}
          </Text>
        )}
        <View style={styles.actions}>
          <Card>
            <ListRow
              title={current.name}
              subtitle={summarize(current.equipment)}
              onPress={() => router.push('/select-location')}
            />
          </Card>
          <Button label={t('today.start')} onPress={startFree} />
          {!plan.data && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/plan')}
              style={styles.textButton}>
              <Text variant="label" color="textMuted">
                {t('plan.create')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xxxl,
  },
  actions: {
    marginTop: space.xl,
    gap: space.md,
  },
  textButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
