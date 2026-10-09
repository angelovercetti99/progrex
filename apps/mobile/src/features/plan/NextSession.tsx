import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import type { Location } from '@/db/schema';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { getActiveTravel } from '@/features/locations/queries';
import { TravelBanner } from '@/features/locations/TravelBanner';
import { useEquipmentSummary } from '@/features/locations/useEquipmentSummary';
import { startWorkout } from '@/features/workouts/queries';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { TargetBar } from '@/ui/charts/TargetBar';
import { ProgressBar } from '@/ui/ProgressBar';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';

import {
  chooseExercises,
  startPlannedWorkout,
  type PlanState,
  type SessionRef,
  type SlotChoice,
} from './queries';

type NextSessionProps = {
  state: PlanState;
  next: SessionRef;
  location: Location;
};

/** Today's planned session, already adapted to the equipment where you are. */
export function NextSession({ state, next, location }: NextSessionProps) {
  const { t } = useTranslation();
  const exerciseName = useExerciseName();
  const summarize = useEquipmentSummary();
  const { plan } = state.mesocycle;
  const session = plan.sessions[next.session];

  const choices = useLiveQuery(
    () => chooseExercises(plan, next.session, location),
    ['exercises', 'workouts', 'locations'],
    [state.mesocycle.id, next.week, next.session, location.id, location.updatedAt]
  );

  // Travel mode: compare with the same session at your usual place.
  const travel = useLiveQuery(getActiveTravel, ['preferences', 'locations'], []).data ?? null;
  const home = travel?.home && travel.home.id !== location.id ? travel.home : null;
  const homeChoices = useLiveQuery(
    () => (home ? chooseExercises(plan, next.session, home) : Promise.resolve([] as SlotChoice[])),
    ['exercises', 'workouts', 'locations'],
    [state.mesocycle.id, next.week, next.session, home?.id ?? '', home?.updatedAt ?? '']
  ).data;

  const setsOf = (list: SlotChoice[]) =>
    list
      .filter((choice) => choice.exercise)
      .reduce((sum, choice) => sum + choice.slot.setsPerWeek[next.week], 0);
  const homeSets = homeChoices ? setsOf(homeChoices) : 0;
  // Same sets are planned everywhere; only slots impossible here are lost.
  const equivalence = home && homeSets > 0 && choices.data ? setsOf(choices.data) / homeSets : null;
  const homeExercise = (slotId: string) => homeChoices?.find((choice) => choice.slot.id === slotId)?.exercise;

  async function start() {
    const id = await startPlannedWorkout(state, next, location);
    router.push(`/workout/${id}`);
  }

  async function startFree() {
    const id = await startWorkout(location.id);
    router.push(`/workout/${id}`);
  }

  return (
    <View style={styles.container}>
      {travel && <TravelBanner travel={travel} />}

      <View style={styles.heading}>
        <Text variant="heading">{t('plan.nextSession', { week: next.week + 1, key: session.key })}</Text>
        <Text color="textMuted">
          {t(`focus.${session.focus}`)}
          {plan.weeks[next.week].deload ? ` · ${t('plan.weekDeload', { n: next.week + 1 })}` : ''}
        </Text>
        <View style={styles.progress}>
          <ProgressBar value={state.done.length / (plan.weeks.length * plan.sessions.length)} />
        </View>
      </View>

      <Card>
        <ListRow
          title={location.name}
          subtitle={summarize(location.equipment)}
          onPress={() => router.push('/select-location')}
        />
      </Card>

      {equivalence !== null && home && (
        <Card style={styles.equivalence}>
          <View style={styles.row}>
            <Text variant="label" style={styles.exerciseName}>
              {t('travel.equivalence')}
            </Text>
            <Text variant="label" numeric>
              ≈ {Math.round(equivalence * 100)}%
            </Text>
          </View>
          <View style={styles.row}>
            {/* TargetBar stretches along a row, like in the Progress screen. */}
            <TargetBar value={equivalence} target={1} max={1} />
          </View>
          <Text variant="caption" color="textMuted">
            {t('travel.equivalenceHelp', { place: home.name })}
          </Text>
        </Card>
      )}

      <Card>
        {(choices.data ?? []).map(({ slot, exercise }, index) => {
          const usual = home ? homeExercise(slot.id) : undefined;
          const changed = usual && exercise && usual.id !== exercise.id;
          return (
            <Fragment key={slot.id}>
              {index > 0 && <Divider />}
              <View style={styles.exerciseRow}>
                <View style={styles.exerciseName}>
                  <Text color={exercise ? 'text' : 'textMuted'}>
                    {exercise ? exerciseName(exercise) : t(`patterns.${slot.pattern}`)}
                  </Text>
                  {changed && (
                    <Text variant="caption" color="textMuted">
                      {t('travel.insteadOf', { exercise: exerciseName(usual) })}
                    </Text>
                  )}
                </View>
                <Text variant="caption" color="textMuted" numeric>
                  {exercise
                    ? `${slot.setsPerWeek[next.week]} × ${slot.repMin}–${slot.repMax}`
                    : t('plan.skipped')}
                </Text>
              </View>
            </Fragment>
          );
        })}
      </Card>

      <Button label={t('plan.start', { key: session.key })} onPress={start} />
      <Pressable accessibilityRole="button" onPress={startFree} style={styles.textButton}>
        <Text variant="label" color="textMuted">
          {t('plan.freeWorkout')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  heading: {
    gap: 2,
  },
  progress: {
    marginTop: space.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min,
    paddingVertical: space.sm,
  },
  exerciseName: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equivalence: {
    paddingVertical: space.lg,
    gap: space.sm,
  },
  textButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
