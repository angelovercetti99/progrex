import {
  activeHealth,
  dateWeeksAgo,
  dueDateFromWeek,
  HEALTH_CONDITIONS,
  NO_HEALTH,
  pregnancyWeek,
  weeksSince,
  type HealthCondition,
  type HealthProfile,
  type HealthStage,
} from '@progrex/shared';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { todayLocalDate } from '@/db/stamps';
import { getHealthProfile, setHealthProfile } from '@/features/health/queries';
import { Card, Divider } from '@/ui/Card';
import { CheckRow } from '@/ui/CheckRow';
import { Stepper } from '@/ui/Stepper';
import { Text } from '@/ui/Text';
import { maxContentWidth, radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Which stop signs to show for each stage (the same list can serve several). */
const STOP_SIGNS: Partial<Record<HealthStage, 'pregnancy' | 'diabetes' | 'heart'>> = {
  pregnancy_1: 'pregnancy',
  pregnancy_2: 'pregnancy',
  pregnancy_3: 'pregnancy',
  postpartum_early: 'pregnancy',
  diabetes: 'diabetes',
  hypertension: 'heart',
  heart_condition: 'heart',
};

/**
 * Health conditions (docs/decisoes.md §50). One tap per condition, and at most
 * one number (the week of pregnancy, or weeks since the birth). Everything
 * else is worked out, and changes by itself as time passes.
 */
export default function HealthScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const today = todayLocalDate();
  const profile = useLiveQuery(getHealthProfile, ['preferences', 'mesocycles'], []).data ?? NO_HEALTH;
  const health = activeHealth(profile, today);

  function save(patch: Partial<HealthProfile>) {
    void setHealthProfile({ ...profile, ...patch });
  }

  function toggle(condition: HealthCondition) {
    const on = profile.conditions.includes(condition);
    const conditions = on
      ? profile.conditions.filter((item) => item !== condition)
      : [...profile.conditions, condition];
    // Sensible starting numbers, adjusted with − and + (never the keyboard).
    const dates: Partial<HealthProfile> = {};
    if (!on && condition === 'pregnancy' && !profile.dueDate) dates.dueDate = dueDateFromWeek(12, today);
    if (!on && condition === 'postpartum' && !profile.birthDate) dates.birthDate = dateWeeksAgo(6, today);
    save({ conditions, ...dates });
  }

  const pregnancyWeeks = profile.dueDate ? pregnancyWeek(profile.dueDate, today) : 12;
  const postpartumWeeks = profile.birthDate ? weeksSince(profile.birthDate, today) : 6;
  const stopSigns = [...new Set(health.stages.map((stage) => STOP_SIGNS[stage]).filter(Boolean))] as (
    'pregnancy' | 'diabetes' | 'heart'
  )[];
  const avoided = [...health.avoid];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        <View style={styles.hero}>
          <Text variant="eyebrow" color="textMuted">
            {t('health.eyebrow')}
          </Text>
          <Text variant="hero">{t('health.title')}</Text>
          <Text color="textMuted">{t('health.intro')}</Text>
        </View>

        <Card>
          {HEALTH_CONDITIONS.map((condition, index) => (
            <Fragment key={condition}>
              {index > 0 && <Divider />}
              <CheckRow
                label={t(`health.conditions.${condition}`)}
                checked={profile.conditions.includes(condition)}
                onToggle={() => toggle(condition)}>
                {/* The one number some conditions need, with − and + (never the keyboard). */}
                {condition === 'pregnancy' ? (
                  <Stepper
                    label={t('health.pregnancyWeek')}
                    value={pregnancyWeeks}
                    min={1}
                    max={42}
                    onChange={(week) => save({ dueDate: dueDateFromWeek(week, today) })}
                  />
                ) : condition === 'postpartum' ? (
                  <Stepper
                    label={t('health.weeksSinceBirth')}
                    value={postpartumWeeks}
                    min={0}
                    max={52}
                    onChange={(weeks) => save({ birthDate: dateWeeksAgo(weeks, today) })}
                  />
                ) : undefined}
              </CheckRow>
            </Fragment>
          ))}
        </Card>

        {/* What changes, in plain words: so it never looks like the app is broken. */}
        {health.stages.length > 0 && (
          <View style={[styles.effects, { borderColor: theme.text }]}>
            <Text variant="label">
              {t('health.today', {
                stages: health.stages.map((stage) => t(`health.stages.${stage}`)).join(', '),
              })}
            </Text>
            {avoided.length > 0 && (
              <Text color="textMuted">
                {t('health.avoids', { list: avoided.map((trait) => t(`health.traits.${trait}`)).join(', ') })}
              </Text>
            )}
            <Text color="textMuted">{t('health.effort', { count: health.minRir })}</Text>
            {health.minRestSeconds > 0 && (
              <Text color="textMuted">{t('health.rest', { seconds: health.minRestSeconds })}</Text>
            )}
            {health.fewerSets && <Text color="textMuted">{t('health.fewerSets')}</Text>}
          </View>
        )}

        {health.clearance && (
          <Card style={styles.note}>
            <Text variant="label">{t('health.clearanceTitle')}</Text>
            <Text color="textMuted">{t('health.clearance')}</Text>
          </Card>
        )}

        {health.preWorkoutCheck && (
          <Card style={styles.note}>
            <Text variant="label">{t('health.glucoseTitle')}</Text>
            <Text color="textMuted">{t('health.glucose')}</Text>
          </Card>
        )}

        {stopSigns.map((kind) => (
          <View key={kind} style={styles.section}>
            <Text variant="eyebrow" color="textMuted">
              {t(`health.stopTitle.${kind}`)}
            </Text>
            <Card style={styles.note}>
              {(t(`health.stopSigns.${kind}`, { returnObjects: true }) as string[]).map((sign) => (
                <View key={sign} style={styles.bulletRow}>
                  <View style={[styles.bullet, { backgroundColor: theme.text }]} />
                  <Text style={styles.bulletText}>{sign}</Text>
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Text variant="caption" color="textMuted">
          {t('health.disclaimer')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
    paddingBottom: space.xxxl,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
  hero: {
    gap: space.xs,
  },
  section: {
    gap: space.sm,
  },
  effects: {
    borderLeftWidth: 3,
    paddingLeft: space.md,
    gap: space.xs,
  },
  note: {
    paddingVertical: space.lg,
    gap: space.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
  },
});
