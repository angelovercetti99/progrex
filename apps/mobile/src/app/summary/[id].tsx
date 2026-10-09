import { router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useLiveQuery } from '@/db/live';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { formatPercent } from '@/features/progress/ProgressView';
import { getWorkoutSummary } from '@/features/progress/queries';
import { getWorkoutDetail } from '@/features/workouts/queries';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { maxContentWidth, radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Shown right after finishing a workout: what it meant for your progress. */
export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useLiveQuery(() => getWorkoutSummary(id), ['workouts', 'sets'], [id]);
  const detail = useLiveQuery(() => getWorkoutDetail(id), ['workouts'], [id]);
  const data = summary.data;
  const workout = detail.data;

  const minutes =
    workout?.finishedAt && workout.startedAt
      ? Math.max(1, Math.round((Date.parse(workout.finishedAt) - Date.parse(workout.startedAt)) / 60000))
      : null;

  // One headline: being away and keeping the stimulus beats everything else.
  let headline = t('summary.defaultTitle');
  let body = t('summary.defaultBody');
  if (data) {
    if (data.away && data.stimulus !== null && data.stimulus >= 0.85) {
      headline = t('summary.awayTitle');
      body = t('summary.awayBody', { pct: Math.round(data.stimulus * 100) });
    } else if (data.personalBests > 0) {
      headline = t('summary.bestsTitle', { count: data.personalBests });
    }
    const top = data.improved[0];
    if (top) {
      body = `${body} ${t('summary.improvedBody', {
        pattern: t(`patterns.${top.pattern}`),
        pct: Math.round(top.change * 100),
      })}`;
    }
  }

  /** "1st time", "+2 reps" (same weight) or "+4%". */
  function resultLabel(result: { change: number | null; repsDelta: number | null }): string {
    if (result.change === null) return t('summary.firstTime');
    if (result.repsDelta !== null) {
      if (result.repsDelta === 0) return '=';
      return t('summary.repsDelta', {
        count: result.repsDelta,
        sign: result.repsDelta > 0 ? '+' : '−',
        n: Math.abs(result.repsDelta),
      });
    }
    return formatPercent(result.change, 0);
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        <Animated.View entering={ZoomIn.duration(350)} style={styles.check}>
          <Svg width={72} height={72} viewBox="0 0 64 64">
            <Circle cx={32} cy={32} r={30} fill={theme.text} />
            <Path
              d="M19 33 l9 9 l17 -19"
              stroke={theme.background}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <Text variant="title" align="center">
          {workout?.planSession !== null && workout?.planSession !== undefined
            ? t('summary.sessionTitle', {
                key: (workout.planSessionsCovered ?? [workout.planSession])
                  .map((index) => String.fromCharCode(65 + index))
                  .join(' + '),
              })
            : t('summary.title')}
        </Text>
        {workout && (
          <Text color="textMuted" align="center">
            {minutes
              ? t('summary.meta', { place: workout.location?.name ?? '', minutes })
              : (workout.location?.name ?? '')}
          </Text>
        )}

        {data && (
          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.grid}>
            <Metric label={t('summary.hardSets')} value={String(data.hardSets)} />
            <Metric
              label={t('summary.stimulus')}
              value={data.stimulus === null ? '—' : `${Math.round(data.stimulus * 100)}%`}
            />
            <Metric
              label={t('summary.index')}
              value={
                data.indexDelta === null
                  ? '—'
                  : Math.abs(data.indexDelta) < 0.0005
                    ? '='
                    : formatPercent(data.indexDelta)
              }
            />
            <Metric label={t('summary.bests')} value={String(data.personalBests)} />
          </Animated.View>
        )}

        <Card style={styles.card}>
          <Text variant="heading">{headline}</Text>
          <Text color="textMuted">{body}</Text>
        </Card>

        {data && data.results.length > 0 && (
          <Card style={styles.card}>
            {data.results.map((result, index) => {
              const exercise = workout?.exercises.find(
                (item) => item.exerciseId === result.exerciseId
              )?.exercise;
              return (
                <Fragment key={result.exerciseId}>
                  {index > 0 && <Divider />}
                  <View style={styles.resultRow}>
                    <Text style={styles.flex} numberOfLines={1}>
                      {exercise ? exerciseName(exercise) : ''}
                    </Text>
                    <Text variant="caption" color="textMuted" numeric>
                      {result.reps.join(' · ')}
                    </Text>
                    <Text variant="label" numeric style={styles.delta}>
                      {resultLabel(result)}
                    </Text>
                  </View>
                </Fragment>
              );
            })}
          </Card>
        )}

        <Button label={t('summary.done')} onPress={close} />
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: theme.surface }]}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="title" numeric>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
    paddingTop: space.xxxl,
    paddingBottom: space.xxxl,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.md,
  },
  check: {
    alignItems: 'center',
    marginBottom: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  metric: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: 2,
  },
  card: {
    paddingVertical: space.lg,
    gap: space.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  flex: {
    flex: 1,
  },
  delta: {
    width: 56,
    textAlign: 'right',
  },
});
