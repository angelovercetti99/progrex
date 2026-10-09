import { DAYS_PER_WEEK, GOALS, type Goal } from '@progrex/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { LOCATION_PRESETS, type LocationPreset } from '@/features/locations/presets';
import { createLocation } from '@/features/locations/queries';
import { createMesocycle } from '@/features/plan/queries';
import { skipQuickStart } from '@/lib/preferences';
import { Card } from '@/ui/Card';
import { LogoMark } from '@/ui/Logo';
import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/**
 * First run in three taps: where, goal, days. Everything else gets a sensible
 * default (60 min, intermediate, no priority areas) and can be tuned later.
 * No forms, no typing: convenience first (docs/decisoes.md §42).
 */
export function QuickStart({ hasPlace }: { hasPlace: boolean }) {
  const { t } = useTranslation();
  // A place may already exist (e.g. created in Settings): then start at the goal.
  const [step, setStep] = useState<0 | 1 | 2>(hasPlace ? 1 : 0);
  const [goal, setGoal] = useState<Goal>('hypertrophy');

  async function choosePlace(preset: LocationPreset) {
    const name = t(`locations.preset${preset[0].toUpperCase()}${preset.slice(1)}` as 'locations.presetGym');
    await createLocation(name, LOCATION_PRESETS[preset]);
    setStep(1);
  }

  function chooseGoal(value: Goal) {
    setGoal(value);
    setStep(2);
  }

  async function chooseDays(days: number) {
    await createMesocycle({ goal, daysPerWeek: days, sessionMinutes: 60, experience: 'intermediate' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <LogoMark size={64} />
      </View>
      <Text variant="caption" color="textMuted" align="center">
        {t('quickStart.step', { n: step + 1, total: 3 })}
      </Text>

      {step === 0 && (
        <Animated.View key="place" entering={FadeInRight.duration(250)} style={styles.step}>
          <Text variant="title" align="center">
            {t('quickStart.where')}
          </Text>
          <Option
            title={t('locations.presetGym')}
            subtitle={t('quickStart.gymHint')}
            onPress={() => choosePlace('gym')}
          />
          <Option
            title={t('locations.presetHome')}
            subtitle={t('quickStart.homeHint')}
            onPress={() => choosePlace('home')}
          />
          <Option
            title={t('quickStart.nothing')}
            subtitle={t('quickStart.nothingHint')}
            onPress={() => choosePlace('hotel')}
          />
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View key="goal" entering={FadeInRight.duration(250)} style={styles.step}>
          <Text variant="title" align="center">
            {t('quickStart.goal')}
          </Text>
          {GOALS.map((value) => (
            <Option key={value} title={t(`goals.${value}`)} onPress={() => chooseGoal(value)} />
          ))}
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View key="days" entering={FadeInRight.duration(250)} style={styles.step}>
          <Text variant="title" align="center">
            {t('quickStart.days')}
          </Text>
          <View style={styles.daysRow}>
            {DAYS_PER_WEEK.map((days) => (
              <DayButton key={days} days={days} onPress={() => chooseDays(days)} />
            ))}
          </View>
          <Text variant="caption" color="textMuted" align="center">
            {t('quickStart.later')}
          </Text>
        </Animated.View>
      )}

      {hasPlace && (
        <Pressable accessibilityRole="button" onPress={skipQuickStart} style={styles.skip}>
          <Text variant="label" color="textMuted">
            {t('quickStart.skip')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Option({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.option}>
        <Text variant="heading">{title}</Text>
        {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
      </Card>
    </Pressable>
  );
}

function DayButton({ days, onPress }: { days: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.day, { backgroundColor: theme.surface }, pressed && styles.pressed]}>
      <Text variant="title" numeric>
        {days}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
    paddingVertical: space.xl,
  },
  logo: {
    alignItems: 'center',
  },
  step: {
    gap: space.md,
  },
  option: {
    paddingVertical: space.lg,
    gap: 2,
  },
  daysRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    minHeight: touch.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
  skip: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
