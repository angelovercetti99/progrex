import {
  BAR_KG,
  DEFAULT_SET,
  effortForRir,
  exerciseDemo,
  fellShort,
  type Goal,
  platesPerSide,
  suggestSet,
  usesBarbell,
  warmupSets,
} from '@progrex/shared';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useLiveQuery } from '@/db/live';
import type { Exercise, WorkoutSet } from '@/db/schema';
import { ExerciseDemoView } from '@/features/exercises/ExerciseDemoView';
import { ExerciseThumb } from '@/features/exercises/ExerciseThumb';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { useTargetMessage } from '@/features/progression/useTargetMessage';
import { confirm } from '@/lib/confirm';
import { getShowRir } from '@/lib/preferences';
import { BigStepper } from '@/ui/BigStepper';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { formatNumber, Stepper } from '@/ui/Stepper';
import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { EffortPicker } from './EffortPicker';
import { formatSet, summarizeSets } from './formatSet';
import {
  completeSet,
  deleteSet,
  getLastPerformance,
  removeExerciseFromWorkout,
  swapExercise,
  updateSet,
  type SetValues,
  type WorkoutExerciseDetail,
} from './queries';

const DEFAULT_VALUES = DEFAULT_SET;

type ExerciseCardProps = {
  workoutId: string;
  item: WorkoutExerciseDetail;
  goal: Goal;
  /** For the "variant" lever: the next step up available here. */
  harder: Exercise | null;
  /** Only the active card shows the set logger. */
  active: boolean;
  /** "2 of 6": where this exercise is in today's workout. */
  position: { n: number; total: number };
  /** First heavy lift for these muscles today: show the warm-up sets. */
  warmup?: boolean;
  onActivate: () => void;
};

export function ExerciseCard({
  workoutId,
  item,
  goal,
  harder,
  active,
  position,
  warmup = false,
  onActivate,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const targetMessage = useTargetMessage();
  const kg = t('common.kg');
  const usesWeight = item.exercise.loadType === 'external';
  // Built-in exercises have a demo; custom ones don't.
  const demo = exerciseDemo(item.exercise.nameKey);
  const target = item.target;
  // Beginners see effort in words; people who know RIR can turn the numbers on.
  const showRir = useLiveQuery(getShowRir, ['preferences'], []).data ?? false;

  const lastTime = useLiveQuery(
    () => getLastPerformance(item.exerciseId),
    ['workouts', 'sets'],
    [item.exerciseId]
  );
  const lastSets = lastTime.data?.sets ?? [];

  // The set being edited (null = logging a new set).
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  // What the user changed with the steppers (null = use the suggestion).
  const [override, setOverride] = useState<SetValues | null>(null);

  // Today's last set fell 2+ reps short of its target: not your day for this one.
  const shortToday = fellShort(target, item.sets);

  // Pre-filled values, so a set that goes as planned is ONE tap (shared with the watch).
  const values = override ?? suggestSet({ target, today: item.sets, last: lastSets, usesWeight });

  function change(patch: Partial<SetValues>) {
    setOverride({ ...values, ...patch });
  }

  async function submit() {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (editingSet) {
      await updateSet(editingSet.id, values);
    } else {
      await completeSet(workoutId, item.id, values);
    }
    setEditingSet(null);
    setOverride(null);
  }

  function startEditing(set: WorkoutSet) {
    onActivate();
    setEditingSet(set);
    setOverride({ reps: set.reps, weightKg: set.weightKg, rir: set.rir });
  }

  function stopEditing() {
    setEditingSet(null);
    setOverride(null);
  }

  async function removeSet() {
    if (!editingSet) return;
    await deleteSet(editingSet.id);
    stopEditing();
  }

  function openHowTo() {
    router.push({ pathname: '/how-to/[id]', params: { id: item.exerciseId } });
  }

  async function removeExercise() {
    const message = `${t('workout.removeExercise')}?`;
    if (await confirm(message, t('common.delete'), t('common.cancel'))) {
      await removeExerciseFromWorkout(item.id);
    }
  }

  const lastSummary = summarizeSets(lastSets, kg, t('workout.reps'));
  const remainingTargets = target ? target.sets.slice(item.sets.length) : [];
  const targetRir = target?.sets[item.sets.length]?.rir ?? target?.sets[0]?.rir ?? DEFAULT_VALUES.rir;
  const details = target
    ? [
        target.lever === 'deload'
          ? null
          : targetRir === 0
            ? t('progression.reserveNone')
            : t('progression.reserve', { count: targetRir }),
        t('progression.rest_short', { rest: target.restSeconds }),
        target.tempoEccentricSeconds
          ? t('progression.tempo_short', { seconds: target.tempoEccentricSeconds })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  // Sums the app can do for you: warm-up steps and the plates on each side.
  const barbell = usesBarbell(item.exercise.equipment);
  const warmupSteps =
    warmup && usesWeight && item.sets.length === 0 && !editingSet
      ? warmupSets({
          workKg: values.weightKg ?? 0,
          incrementKg: item.exercise.loadIncrementKg,
          barbell,
        })
      : [];
  // The weight is the total, bar included. Below the bar's own weight there's nothing to load.
  const weightKg = values.weightKg ?? 0;
  const plates = barbell ? platesPerSide(weightKg) : null;
  const platesText = !barbell
    ? null
    : plates
      ? t(plates.exact ? 'workout.platesPerSide' : 'workout.platesApprox', {
          plates: plates.perSide.map(formatNumber).join(' + ') || '0',
        })
      : weightKg === BAR_KG
        ? t('workout.barOnly')
        : null;

  const canSwap =
    (target?.lever === 'variant' || target?.lever === 'plateau') && harder !== null && item.sets.length === 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        {!active && <ExerciseThumb exercise={item.exercise} size={44} />}
        <Pressable onPress={onActivate} disabled={active} style={styles.header}>
          <Text variant="eyebrow" color="textMuted" numeric>
            {t('workout.position', position)}
          </Text>
          <Text variant="heading">{exerciseName(item.exercise)}</Text>
          {lastSummary ? (
            <Text variant="caption" color="textMuted">
              {t('workout.lastTime', { summary: lastSummary })}
            </Text>
          ) : null}
        </Pressable>
        {/* The active card shows the demo itself; the others just a shortcut to it. */}
        {demo && !active && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('howTo.open')}
            hitSlop={8}
            onPress={openHowTo}
            style={styles.howTo}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              tintColor={theme.textMuted}
              size={22}
            />
          </Pressable>
        )}
      </View>

      {active && demo && (
        // How the exercise is done, always in view while you do it. Tap for the cues.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('howTo.open')}
          onPress={openHowTo}
          style={[styles.demo, { backgroundColor: theme.surfaceMuted }]}>
          <View style={styles.demoFigure}>
            <ExerciseDemoView demo={demo} />
          </View>
        </Pressable>
      )}

      {target && (
        <View style={[styles.target, { borderColor: theme.accent }]}>
          <Text variant="label" color="accentText" style={styles.targetMessage}>
            {targetMessage(target, goal, usesWeight, harder ? exerciseName(harder) : null)}
          </Text>
          <Text variant="caption" color="textMuted">
            {details}
          </Text>
          {canSwap && harder && (
            <View style={styles.swap}>
              <Chip label={t('progression.swap')} onPress={() => swapExercise(item.id, harder.id)} />
            </View>
          )}
        </View>
      )}

      {(item.sets.length > 0 || remainingTargets.length > 0) && (
        <View style={styles.sets}>
          {item.sets.map((set) => (
            <Animated.View
              key={set.id}
              entering={FadeInDown.duration(250)}
              layout={LinearTransition.duration(200)}>
              <Pressable
                onPress={() => (editingSet?.id === set.id ? stopEditing() : startEditing(set))}
                style={[styles.setRow, editingSet?.id === set.id && { backgroundColor: theme.surfaceMuted }]}>
                <View style={styles.setIndex}>
                  <SymbolView
                    name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                    tintColor={theme.text}
                    size={20}
                  />
                </View>
                <Text numeric style={styles.setMain}>
                  {usesWeight ? formatSet(set, kg) : `${set.reps} ${t('workout.reps')}`}
                </Text>
                {set.rir !== null && (
                  <Text variant="caption" color="textMuted" numeric>
                    {showRir ? `${t('workout.rir')} ${set.rir}` : t(`effort.${effortForRir(set.rir)}`)}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          ))}
          {/* What's still planned for today, in a quieter style. */}
          {remainingTargets.map((planned, offset) => (
            <Animated.View
              key={`target-${item.sets.length + offset}`}
              layout={LinearTransition.duration(200)}
              style={styles.setRow}>
              <View style={styles.setIndex}>
                <View style={[styles.pendingDot, { borderColor: theme.border }]} />
              </View>
              <Text color="textMuted" numeric style={styles.setMain}>
                {usesWeight && planned.weightKg !== null
                  ? formatSet(planned, kg)
                  : `${planned.reps} ${t('workout.reps')}`}
              </Text>
              <Text variant="caption" color="textMuted">
                {t('workout.target')}
              </Text>
            </Animated.View>
          ))}
        </View>
      )}

      {active && (
        <>
          <Divider />
          <View style={styles.logger}>
            <Text variant="label" color="textMuted">
              {t('workout.set')} {editingSet ? item.sets.indexOf(editingSet) + 1 : item.sets.length + 1}
            </Text>
            {shortToday && !editingSet && (
              <Text variant="caption" color="textMuted">
                {t('workout.autoAdjusted')}
              </Text>
            )}
            {warmupSteps.length > 0 && (
              <Text variant="caption" color="textMuted" numeric>
                {t('workout.warmup', {
                  steps: warmupSteps.map((step) => formatSet(step, kg)).join(' · '),
                })}
              </Text>
            )}
            {usesWeight && (
              <View style={styles.weight}>
                <BigStepper
                  label={t('workout.weight')}
                  unit={kg}
                  value={values.weightKg ?? 0}
                  step={item.exercise.loadIncrementKg || 1}
                  max={500}
                  onChange={(weightKg) => change({ weightKg })}
                />
                {platesText && (
                  <Text variant="caption" color="textMuted" align="center" numeric>
                    {platesText}
                  </Text>
                )}
              </View>
            )}
            <BigStepper
              label={t('workout.repsLabel')}
              value={values.reps}
              min={1}
              max={100}
              onChange={(reps) => change({ reps })}
            />
            {showRir ? (
              <Stepper
                label={t('workout.rir')}
                hint={t('workout.rirHint')}
                value={values.rir ?? DEFAULT_VALUES.rir}
                max={5}
                onChange={(rir) => change({ rir })}
              />
            ) : (
              <EffortPicker
                rir={values.rir ?? targetRir}
                targetRir={targetRir}
                onChange={(rir) => change({ rir })}
              />
            )}
            <Button label={editingSet ? t('workout.updateSet') : t('workout.completeSet')} onPress={submit} />
            {editingSet ? (
              <Button variant="secondary" label={t('workout.deleteSet')} onPress={removeSet} />
            ) : (
              <View style={styles.cardActions}>
                {item.sets.length === 0 && (
                  // Machine taken, or just not today: another exercise for the same movement.
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: '/add-exercise', params: { workoutId, replace: item.id } })
                    }
                    style={styles.textButton}>
                    <Text variant="label" color="textMuted">
                      {t('workout.swap')}
                    </Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" onPress={removeExercise} style={styles.textButton}>
                  <Text variant="label" color="textMuted">
                    {t('workout.removeExercise')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.lg,
    gap: space.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  header: {
    flex: 1,
    gap: 2,
  },
  howTo: {
    width: touch.min,
    height: touch.min,
    marginTop: -space.md,
    marginRight: -space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: {
    alignItems: 'center',
    borderRadius: radius.sm,
    paddingVertical: space.xs,
  },
  demoFigure: {
    width: '100%',
    height: 150,
  },
  target: {
    borderLeftWidth: 3,
    paddingLeft: space.md,
    gap: 2,
  },
  targetMessage: {
    fontSize: 16,
    fontWeight: '700',
  },
  swap: {
    flexDirection: 'row',
    marginTop: space.sm,
  },
  sets: {
    gap: 2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touch.min - 8,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: radius.sm,
  },
  setIndex: {
    width: 22,
    alignItems: 'center',
  },
  pendingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  setMain: {
    flex: 1,
  },
  weight: {
    gap: space.xs,
  },
  logger: {
    gap: space.lg,
    paddingTop: space.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
  },
  textButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
