import {
  BAR_KG,
  DEFAULT_SET,
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
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

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
import { DURATION } from '@/ui/motion';
import { PressableScale } from '@/ui/PressableScale';
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
import { SetDots } from './SetDots';

const DEFAULT_VALUES = DEFAULT_SET;
/** The animated figure next to the name of the exercise you're on. */
const DEMO_SIZE = 96;

type ExerciseCardProps = {
  workoutId: string;
  item: WorkoutExerciseDetail;
  goal: Goal;
  /** For the "variant" lever: the next step up available here. */
  harder: Exercise | null;
  /** Only the active card shows the set logger; the others are one compact row. */
  active: boolean;
  /** "2 of 6": where this exercise is in today's workout. */
  position: { n: number; total: number };
  /** First heavy lift for these muscles today: show the warm-up sets. */
  warmup?: boolean;
  onActivate: () => void;
};

export function ExerciseCard(props: ExerciseCardProps) {
  return (
    // The card grows and shrinks smoothly when it becomes (or stops being) the active one.
    <Animated.View layout={LinearTransition.duration(DURATION.base)}>
      {props.active ? <ActiveCard {...props} /> : <CompactCard {...props} />}
    </Animated.View>
  );
}

/** Not the one you're on: one row. Tap to make it the active one. */
function CompactCard({ item, position, onActivate }: ExerciseCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const planned = item.target?.sets.length ?? 0;
  const complete = item.sets.length > 0 && item.sets.length >= planned;

  return (
    <PressableScale accessibilityRole="button" onPress={onActivate} scaleTo={0.98}>
      <Card style={[styles.compact, complete && styles.completeCard]}>
        <ExerciseThumb exercise={item.exercise} size={44} />
        <View style={styles.compactTexts}>
          <Text variant="caption" color="textMuted" numeric>
            {t('workout.position', position)}
            {planned ? ` · ${t('today.setsOf', { done: item.sets.length, total: planned })}` : ''}
          </Text>
          <Text variant="label" numberOfLines={1}>
            {exerciseName(item.exercise)}
          </Text>
        </View>
        {complete ? (
          <Animated.View entering={FadeIn.duration(DURATION.base)}>
            <SymbolView
              name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
              tintColor={theme.text}
              size={24}
            />
          </Animated.View>
        ) : (
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            tintColor={theme.textMuted}
            size={18}
          />
        )}
      </Card>
    </PressableScale>
  );
}

/** The exercise you're on: what to do, your sets so far, and the set logger. */
function ActiveCard({ workoutId, item, goal, harder, position, warmup = false }: ExerciseCardProps) {
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

  function toggleEditing(set: WorkoutSet) {
    if (editingSet?.id === set.id) {
      stopEditing();
      return;
    }
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
  const setNumber = editingSet ? item.sets.indexOf(editingSet) + 1 : item.sets.length + 1;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        {/* How it's done, always in view while you do it. Tap for the cues. */}
        {demo ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('howTo.open')}
            onPress={openHowTo}
            style={[styles.demo, { backgroundColor: theme.surfaceMuted }]}>
            <ExerciseDemoView demo={demo} />
          </PressableScale>
        ) : (
          <ExerciseThumb exercise={item.exercise} size={DEMO_SIZE} />
        )}
        <View style={styles.header}>
          <Text variant="eyebrow" color="textMuted" numeric>
            {t('workout.position', position)}
          </Text>
          <Text variant="heading">{exerciseName(item.exercise)}</Text>
          {lastSummary ? (
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {t('workout.lastTime', { summary: lastSummary })}
            </Text>
          ) : null}
        </View>
      </View>

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
        <SetDots
          done={item.sets}
          remaining={remainingTargets}
          editingId={editingSet?.id ?? null}
          onEdit={toggleEditing}
        />
      )}

      <Divider />
      <View style={styles.logger}>
        <View style={styles.loggerHeader}>
          <Text variant="label" color="textMuted">
            {editingSet ? t('workout.editingSet', { n: setNumber }) : `${t('workout.set')} ${setNumber}`}
          </Text>
          {shortToday && !editingSet && (
            <Text variant="caption" color="textMuted">
              {t('workout.autoAdjusted')}
            </Text>
          )}
        </View>
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
              onChange={(next) => change({ weightKg: next })}
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
          <View style={styles.cardActions}>
            <TextButton label={t('common.cancel')} onPress={stopEditing} />
            <TextButton label={t('workout.deleteSet')} onPress={removeSet} />
          </View>
        ) : (
          <View style={styles.cardActions}>
            {item.sets.length === 0 && (
              // Machine taken, or just not today: another exercise for the same movement.
              <TextButton
                label={t('workout.swap')}
                onPress={() =>
                  router.push({ pathname: '/add-exercise', params: { workoutId, replace: item.id } })
                }
              />
            )}
            <TextButton label={t('workout.removeExercise')} onPress={removeExercise} />
          </View>
        )}
      </View>
    </Card>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.lg,
    gap: space.lg,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  completeCard: {
    opacity: 0.6,
  },
  compactTexts: {
    flex: 1,
    gap: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  header: {
    flex: 1,
    gap: 2,
  },
  demo: {
    width: DEMO_SIZE,
    height: DEMO_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
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
  weight: {
    gap: space.xs,
  },
  logger: {
    gap: space.lg,
  },
  loggerHeader: {
    gap: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xl,
    marginTop: -space.sm,
  },
  textButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
