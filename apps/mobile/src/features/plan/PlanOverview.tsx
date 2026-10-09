import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { intensityForRir } from '@progrex/shared';

import { useLiveQuery } from '@/db/live';
import { confirm } from '@/lib/confirm';
import { getShowRir } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { ProgressBar } from '@/ui/ProgressBar';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { endMesocycle, sessionKey, type PlanState } from './queries';

/**
 * The block at a glance: overall progress, the current week open, the others
 * folded into one line each (tap to open).
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
  const [open, setOpen] = useState<Set<number>>(() => new Set([currentWeek]));

  function toggle(week: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }

  async function newPlan() {
    if (complete) {
      await endMesocycle(state.mesocycle.id, 'completed');
    } else if (await confirm(t('plan.newPlanConfirm'), t('plan.newPlan'), t('common.cancel'))) {
      await endMesocycle(state.mesocycle.id, 'abandoned');
    }
  }

  function weekTitle(index: number): string {
    const week = plan.weeks[index];
    if (week.deload) return t('plan.weekDeload', { n: index + 1 });
    return showRir
      ? t('plan.weekRir', { n: index + 1, rir: week.rir })
      : t('plan.weekEffort', { n: index + 1, level: t(`effort.intensity.${intensityForRir(week.rir)}`) });
  }

  return (
    <View style={styles.container}>
      {/* Overall progress */}
      <View style={styles.progress}>
        <Text variant="heading">
          {complete
            ? t('plan.completeTitle')
            : t('plan.weekOf', { n: currentWeek + 1, total: plan.weeks.length })}
        </Text>
        <ProgressBar value={done.size / total} />
        <Text variant="caption" color="textMuted">
          {t('plan.sessionsDone', { done: done.size, total })} ·{' '}
          {t('plan.summary', {
            goal: t(`goals.${plan.goal}`),
            days: plan.daysPerWeek,
            minutes: plan.sessionMinutes,
          })}
          {plan.priorityAreas?.length
            ? ` · ${t('plan.focusSummary', {
                areas: plan.priorityAreas.map((area) => t(`areas.${area}`)).join(', '),
              })}`
            : ''}
        </Text>
      </View>

      {complete && <Button label={t('plan.newPlan')} onPress={newPlan} />}

      <Card>
        {plan.weeks.map((week, weekIndex) => {
          const weekDone = plan.sessions.every((_, session) =>
            done.has(sessionKey({ week: weekIndex, session }))
          );
          const isOpen = open.has(weekIndex);
          return (
            <Fragment key={weekIndex}>
              {weekIndex > 0 && <Divider />}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                onPress={() => toggle(weekIndex)}
                style={styles.weekRow}>
                <Text
                  variant={weekIndex === currentWeek ? 'label' : 'body'}
                  color={weekDone ? 'textMuted' : 'text'}
                  style={styles.weekTitle}>
                  {weekTitle(weekIndex)}
                </Text>
                {weekDone && <DoneIcon color={theme.textMuted} />}
                <SymbolView
                  name={{
                    ios: isOpen ? 'chevron.up' : 'chevron.down',
                    android: isOpen ? 'expand_less' : 'expand_more',
                    web: isOpen ? 'expand_less' : 'expand_more',
                  }}
                  tintColor={theme.textMuted}
                  size={16}
                />
              </Pressable>

              {isOpen && (
                <Animated.View entering={FadeIn.duration(200)} layout={LinearTransition.duration(200)}>
                  {plan.sessions.map((session, sessionIndex) => {
                    const ref = { week: weekIndex, session: sessionIndex };
                    const isDone = done.has(sessionKey(ref));
                    const isNext = state.next?.week === weekIndex && state.next.session === sessionIndex;
                    return (
                      <View key={session.key} style={styles.session}>
                        <ListRow
                          title={`${t('plan.session', { key: session.key })} · ${t(`focus.${session.focus}`)}`}
                          subtitle={session.slots.map((slot) => t(`patterns.${slot.pattern}`)).join(', ')}
                          right={
                            isDone ? (
                              <DoneIcon color={theme.text} />
                            ) : isNext ? (
                              <Text variant="label">{t('plan.next')}</Text>
                            ) : null
                          }
                        />
                      </View>
                    );
                  })}
                </Animated.View>
              )}
            </Fragment>
          );
        })}
      </Card>

      {!complete && <Button variant="secondary" label={t('plan.newPlan')} onPress={newPlan} />}
    </View>
  );
}

function DoneIcon({ color }: { color: string }) {
  return (
    <SymbolView
      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
      tintColor={color}
      size={20}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xl,
    paddingBottom: space.xl,
  },
  progress: {
    gap: space.sm,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch.primary,
  },
  weekTitle: {
    flex: 1,
  },
  session: {
    paddingLeft: space.md,
  },
});
