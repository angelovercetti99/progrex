import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { intensityForRir } from '@progrex/shared';

import { useLiveQuery } from '@/db/live';
import { confirm } from '@/lib/confirm';
import { getShowRir } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { ProgressBar } from '@/ui/ProgressBar';
import { Text } from '@/ui/Text';
import { radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { endMesocycle, sessionKey, type PlanState } from './queries';

/**
 * The block at a glance: where you are, how hard each week is (a small bar
 * chart; tap a week to see its sessions), and that week's sessions.
 */
export function PlanOverview({ state }: { state: PlanState }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { plan } = state.mesocycle;
  const done = new Set(state.done);
  const complete = state.next === null;
  const currentWeek = state.next?.week ?? plan.weeks.length - 1;
  const total = plan.weeks.length * plan.sessions.length;

  const showRir = useLiveQuery(getShowRir, ['preferences'], []).data ?? false;
  const [selected, setSelected] = useState(currentWeek);

  async function newPlan() {
    if (complete) {
      await endMesocycle(state.mesocycle.id, 'completed');
    } else if (await confirm(t('plan.newPlanConfirm'), t('plan.newPlan'), t('common.cancel'))) {
      await endMesocycle(state.mesocycle.id, 'abandoned');
    }
  }

  function weekEffort(index: number): string {
    const week = plan.weeks[index];
    if (week.deload) return t('plan.recovery');
    return showRir
      ? t('plan.rir', { rir: week.rir })
      : t('plan.effort', { level: t(`effort.intensity.${intensityForRir(week.rir)}`) });
  }

  /** Bar height: the closer to failure, the taller. Recovery is the lowest. */
  function barHeight(index: number): number {
    const week = plan.weeks[index];
    if (week.deload) return 0.22;
    return 0.4 + (0.6 * (4 - Math.min(4, week.rir))) / 4;
  }

  const weekDone = (index: number) =>
    plan.sessions.every((_, session) => done.has(sessionKey({ week: index, session })));

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text variant="eyebrow" color="textMuted">
          {t(`goals.${plan.goal}`)} ·{' '}
          {t('plan.daysMinutes', { days: plan.daysPerWeek, minutes: plan.sessionMinutes })}
        </Text>
        <Text variant="hero">
          {complete
            ? t('plan.completeTitle')
            : t('plan.weekOf', { n: currentWeek + 1, total: plan.weeks.length })}
        </Text>
        {plan.priorityAreas?.length ? (
          <Text color="textMuted">
            {t('plan.focusSummary', {
              areas: plan.priorityAreas.map((area) => t(`areas.${area}`)).join(', '),
            })}
          </Text>
        ) : null}
      </View>

      <View style={styles.progress}>
        <ProgressBar value={done.size / total} />
        <Text variant="caption" color="textMuted">
          {t('plan.sessionsDone', { done: done.size, total })}
        </Text>
      </View>

      {complete && <Button label={t('plan.newPlan')} onPress={newPlan} />}

      {/* Effort per week: a bar per week, tap to see that week. */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text variant="label">{t('plan.effortTitle')}</Text>
          <Text variant="caption" color="textMuted">
            {weekEffort(selected)}
          </Text>
        </View>
        <View style={styles.chart}>
          {plan.weeks.map((week, index) => {
            const isSelected = index === selected;
            const isCurrent = index === currentWeek && !complete;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${t('plan.week', { n: index + 1 })}, ${weekEffort(index)}`}
                onPress={() => setSelected(index)}
                style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${barHeight(index) * 100}%`,
                        backgroundColor: isSelected ? theme.accent : theme.surfaceMuted,
                        borderColor: isCurrent && !isSelected ? theme.accent : 'transparent',
                      },
                    ]}>
                    {weekDone(index) && (
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        tintColor={isSelected ? theme.onAccent : theme.textMuted}
                        size={14}
                      />
                    )}
                  </View>
                </View>
                <Text
                  variant="caption"
                  color={isSelected ? 'text' : 'textMuted'}
                  style={isSelected ? styles.barLabelSelected : undefined}
                  numeric>
                  {week.deload ? 'R' : `S${index + 1}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Text variant="eyebrow" color="textMuted" style={styles.sectionTitle}>
        {selected === currentWeek && !complete ? t('plan.thisWeek') : t('plan.week', { n: selected + 1 })}
      </Text>
      <Animated.View key={selected} entering={FadeIn.duration(200)}>
        <Card>
          {plan.sessions.map((session, sessionIndex) => {
            const ref = { week: selected, session: sessionIndex };
            const isDone = done.has(sessionKey(ref));
            const isNext = state.next?.week === selected && state.next.session === sessionIndex;
            return (
              <Fragment key={session.key}>
                {sessionIndex > 0 && <Divider />}
                <ListRow
                  leading={<SessionBadge letter={session.key} done={isDone} next={isNext} />}
                  title={t(`focus.${session.focus}`)}
                  subtitle={session.slots.map((slot) => t(`patterns.${slot.pattern}`)).join(', ')}
                  right={
                    isNext ? (
                      <View style={[styles.nextPill, { backgroundColor: theme.accent }]}>
                        <Text variant="caption" color="onAccent" style={styles.nextText}>
                          {t('plan.next')}
                        </Text>
                      </View>
                    ) : null
                  }
                />
              </Fragment>
            );
          })}
        </Card>
      </Animated.View>

      {!complete && <Button variant="secondary" label={t('plan.newPlan')} onPress={newPlan} />}
    </View>
  );
}

/** The session letter in a circle: filled with a ✓ when done, outlined when it's next. */
function SessionBadge({ letter, done, next }: { letter: string; done: boolean; next: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: done ? theme.accent : theme.surfaceMuted,
          borderColor: next ? theme.accent : 'transparent',
        },
      ]}>
      {done ? (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          tintColor={theme.onAccent}
          size={16}
        />
      ) : (
        <Text variant="label">{letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    paddingBottom: space.xl,
  },
  hero: {
    gap: space.xs,
  },
  progress: {
    gap: space.sm,
  },
  chartCard: {
    paddingVertical: space.lg,
    gap: space.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chart: {
    flexDirection: 'row',
    gap: space.sm,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
  },
  barTrack: {
    height: 88,
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: space.xs,
  },
  barLabelSelected: {
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: space.sm,
    marginBottom: -space.sm,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  nextText: {
    fontWeight: '600',
  },
});
