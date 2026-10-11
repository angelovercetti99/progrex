import { BODY_AREAS, intensityForRir, type BodyArea, type TodayConditions } from '@progrex/shared';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useLiveQuery } from '@/db/live';
import type { Location } from '@/db/schema';
import { ExerciseThumb } from '@/features/exercises/ExerciseThumb';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { getActiveTravel } from '@/features/locations/queries';
import { TravelBanner } from '@/features/locations/TravelBanner';
import { useEquipmentSummary } from '@/features/locations/useEquipmentSummary';
import { startWorkout } from '@/features/workouts/queries';
import { formatToday } from '@/lib/dates';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { IconBadge } from '@/ui/IconBadge';
import { TargetBar } from '@/ui/charts/TargetBar';
import { ListRow } from '@/ui/ListRow';
import { ProgressBar } from '@/ui/ProgressBar';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { StatRow } from '@/ui/StatRow';
import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useSingleFlight } from '@/ui/useSingleFlight';
import { useTheme } from '@/ui/useTheme';

import {
  chooseExercises,
  prepareToday,
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

const QUICK_MINUTES = ['20', '30', '45'] as const;

/**
 * Today's planned session, adapted to where you are and how you are.
 * A normal day needs nothing: tap Start. The three chips are optional.
 */
export function NextSession({ state, next, location }: NextSessionProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const summarize = useEquipmentSummary();
  const { plan } = state.mesocycle;
  const keys = state.group.map((index) => plan.sessions[index].key).join(' + ');
  const session = plan.sessions[state.group[0] ?? next.session];

  // Optional, one tap each. Nothing set = a normal day.
  const [minutes, setMinutes] = useState<string | null>(null);
  const [tired, setTired] = useState(false);
  const [pain, setPain] = useState<BodyArea[] | null>(null);
  const conditions: TodayConditions = {
    minutes: minutes ? Number(minutes) : null,
    tired,
    painAreas: pain ?? [],
  };

  const today = useLiveQuery(
    () => prepareToday(state, location, conditions),
    ['exercises', 'workouts', 'locations'],
    [state.mesocycle.id, next.week, state.group, location.id, location.updatedAt, conditions]
  ).data;

  // Travel mode: compare with the same session at your usual place.
  const travel = useLiveQuery(getActiveTravel, ['preferences', 'locations'], []).data ?? null;
  const home = travel?.home && travel.home.id !== location.id ? travel.home : null;
  // Same adapted session (time, pain…) at both places: this isolates the effect of the PLACE.
  const homeChoices = useLiveQuery(
    () =>
      home && today
        ? chooseExercises(today.adapted.slots, plan.experience, home)
        : Promise.resolve([] as SlotChoice[]),
    ['exercises', 'workouts', 'locations'],
    [
      state.mesocycle.id,
      next.week,
      state.group,
      home?.id ?? '',
      home?.updatedAt ?? '',
      today?.adapted.slots ?? [],
    ]
  ).data;

  const week = plan.weeks[next.week];
  const chosen = (today?.choices ?? []).filter((choice) => choice.exercise);
  const totalSets = chosen.reduce((sum, choice) => sum + (choice.slot.setsPerWeek[next.week] ?? 0), 0);

  const setsOf = (list: SlotChoice[]) =>
    list
      .filter((choice) => choice.exercise)
      .reduce((sum, choice) => sum + (choice.slot.setsPerWeek[next.week] ?? 0), 0);
  const homeSets = homeChoices ? setsOf(homeChoices) : 0;
  const equivalence = home && homeSets > 0 && today ? setsOf(today.choices) / homeSets : null;
  const homeExercise = (slotId: string) => homeChoices?.find((choice) => choice.slot.id === slotId)?.exercise;

  function reasonText(reason: string): string {
    switch (reason) {
      case 'pain':
        return t('adapt.reasons.pain', { areas: (pain ?? []).map((area) => t(`areas.${area}`)).join(', ') });
      case 'short_time':
        return t('adapt.reasons.short_time', { minutes });
      case 'comeback':
      case 'long_break':
        return t(`adapt.reasons.${reason}`, { days: state.daysSinceLastWorkout });
      case 'compressed':
        return t('adapt.reasons.compressed', { count: state.group.length });
      default:
        return t(`adapt.reasons.${reason}` as 'adapt.reasons.tired');
    }
  }

  async function start() {
    const id = await startPlannedWorkout(state, location, conditions);
    router.push(`/workout/${id}`);
  }

  const startFree = useSingleFlight(async () => {
    const id = await startWorkout(location.id);
    router.push(`/workout/${id}`);
  });

  function togglePainArea(area: BodyArea) {
    setPain((current) => {
      const list = current ?? [];
      return list.includes(area) ? list.filter((item) => item !== area) : [...list, area];
    });
  }

  return (
    <View style={styles.container}>
      {travel && <TravelBanner travel={travel} />}

      {/* What today is, at a glance: the day, the session, and its size. */}
      <View style={styles.hero}>
        <Text variant="eyebrow" color="textMuted">
          {formatToday(i18n.language)}
        </Text>
        <Text variant="hero">{t(`focus.${session.focus}`)}</Text>
        <Text color="textMuted">
          {t('plan.nextSession', { week: next.week + 1, key: keys })} ·{' '}
          {week.deload
            ? t('today.recovery')
            : t('today.effort', { level: t(`effort.intensity.${intensityForRir(week.rir)}`) })}
        </Text>
      </View>

      {today && (
        <StatRow
          items={[
            { value: String(chosen.length), label: t('today.statExercises', { count: chosen.length }) },
            { value: String(totalSets), label: t('today.statSets', { count: totalSets }) },
            { value: String(minutes ?? plan.sessionMinutes), label: t('today.statMinutes') },
          ]}
        />
      )}

      <View style={styles.progress}>
        <ProgressBar value={state.done.length / (plan.weeks.length * plan.sessions.length)} />
        <Text variant="caption" color="textMuted">
          {t('plan.sessionsDone', {
            done: state.done.length,
            total: plan.weeks.length * plan.sessions.length,
          })}
        </Text>
      </View>

      <Card>
        <ListRow
          leading={
            <IconBadge name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} />
          }
          title={location.name}
          subtitle={summarize(location.equipment)}
          onPress={() => router.push('/select-location')}
        />
      </Card>

      {/* Optional: only what the app can't know. */}
      <View style={styles.chips}>
        <QuickChip
          label={minutes ? t('adapt.minutes', { n: minutes }) : t('adapt.little_time')}
          active={minutes !== null}
          onPress={() => setMinutes(minutes ? null : '30')}
        />
        <QuickChip label={t('adapt.tired')} active={tired} onPress={() => setTired(!tired)} />
        <QuickChip
          label={t('adapt.pain')}
          active={pain !== null}
          onPress={() => setPain(pain === null ? [] : null)}
        />
      </View>
      {minutes !== null && (
        <Animated.View entering={FadeIn.duration(200)}>
          <SegmentedControl
            value={minutes}
            onChange={setMinutes}
            options={QUICK_MINUTES.map((value) => ({ value, label: t('adapt.minutes', { n: value }) }))}
          />
        </Animated.View>
      )}
      {pain !== null && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.painBox}>
          <Text variant="caption" color="textMuted">
            {t('adapt.whereHurts')}
          </Text>
          <View style={styles.chipsWrap}>
            {BODY_AREAS.map((area) => (
              <QuickChip
                key={area}
                label={t(`areas.${area}`)}
                active={pain.includes(area)}
                onPress={() => togglePainArea(area)}
              />
            ))}
          </View>
          <Text variant="caption" color="textMuted">
            {t('adapt.disclaimer')}
          </Text>
        </Animated.View>
      )}

      {/* Why today looks different, one line per reason. */}
      {today && today.adapted.reasons.length > 0 && (
        <View style={[styles.reasons, { borderColor: theme.text }]}>
          {today.adapted.reasons.map((reason) => (
            <Text key={reason} variant="label">
              {reasonText(reason)}
            </Text>
          ))}
        </View>
      )}

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
            <TargetBar value={equivalence} target={1} max={1} />
          </View>
          <Text variant="caption" color="textMuted">
            {t('travel.equivalenceHelp', { place: home.name })}
          </Text>
        </Card>
      )}

      <Text variant="eyebrow" color="textMuted" style={styles.sectionTitle}>
        {t('today.exercises')}
      </Text>
      <Card>
        {(today?.choices ?? []).map(({ slot, exercise }, index) => {
          const usual = home ? homeExercise(slot.id) : undefined;
          const changed = usual && exercise && usual.id !== exercise.id;
          return (
            <Fragment key={slot.id}>
              {index > 0 && <Divider />}
              <Pressable
                accessibilityRole={exercise?.nameKey ? 'button' : undefined}
                disabled={!exercise?.nameKey}
                onPress={() =>
                  exercise && router.push({ pathname: '/how-to/[id]', params: { id: exercise.id } })
                }
                style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}>
                <ExerciseThumb exercise={exercise ?? null} />
                <View style={styles.exerciseName}>
                  <Text variant="label" color={exercise ? 'text' : 'textMuted'}>
                    {exercise ? exerciseName(exercise) : t(`patterns.${slot.pattern}`)}
                  </Text>
                  <Text variant="caption" color="textMuted" numeric>
                    {exercise
                      ? `${t('today.setsReps', { sets: slot.setsPerWeek[next.week], min: slot.repMin, max: slot.repMax })}`
                      : t('plan.skipped')}
                  </Text>
                  {changed && (
                    <Text variant="caption" color="textMuted">
                      {t('travel.insteadOf', { exercise: exerciseName(usual) })}
                    </Text>
                  )}
                </View>
              </Pressable>
            </Fragment>
          );
        })}
      </Card>

      {today && today.adapted.removed.length > 0 && (
        <View style={styles.removed}>
          <Text variant="caption" color="textMuted">
            {t('adapt.left_out')}:{' '}
            {today.adapted.removed
              .map(({ slot, reason }) => `${t(`patterns.${slot.pattern}`)} (${t(`adapt.because_${reason}`)})`)
              .join(', ')}
          </Text>
        </View>
      )}

      <Button label={t('plan.start', { key: keys })} onPress={start} />
      <Pressable accessibilityRole="button" onPress={startFree} style={styles.textButton}>
        <Text variant="label" color="textMuted">
          {t('plan.freeWorkout')}
        </Text>
      </Pressable>
    </View>
  );
}

function QuickChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.text : theme.surfaceMuted }]}>
      <Text variant="label" color={active ? 'onAccent' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  hero: {
    gap: space.xs,
    marginTop: space.sm,
  },
  progress: {
    gap: space.sm,
  },
  sectionTitle: {
    marginTop: space.sm,
    marginBottom: -space.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touch.min - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  painBox: {
    gap: space.sm,
  },
  reasons: {
    borderLeftWidth: 3,
    paddingLeft: space.md,
    gap: space.xs,
  },
  removed: {
    marginTop: -space.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.primary,
    paddingVertical: space.md,
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
