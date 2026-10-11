import {
  DAYS_PER_WEEK,
  EXPERIENCE_LEVELS,
  GOALS,
  SESSION_MINUTES,
  type BodyArea,
  type Experience,
  type Goal,
  type Mesocycle,
} from '@progrex/shared';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { BodyMap } from './BodyMap';
import { createMesocycle } from './queries';

/**
 * "Create your plan": four choices and one button. After a block, the choices
 * start where the last plan left them (change only what's different).
 */
export function PlanSetup({ initialGoal, previous }: { initialGoal: Goal; previous?: Mesocycle }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [goal, setGoal] = useState<Goal>(previous?.goal ?? initialGoal);
  const [days, setDays] = useState(String(previous?.daysPerWeek ?? 3));
  const [minutes, setMinutes] = useState(String(previous?.sessionMinutes ?? 60));
  const [experience, setExperience] = useState<Experience>(previous?.experience ?? 'intermediate');
  const [areas, setAreas] = useState<BodyArea[]>(previous?.priorityAreas ?? []);

  async function create() {
    await createMesocycle({
      goal,
      experience,
      daysPerWeek: Number(days),
      sessionMinutes: Number(minutes),
      priorityAreas: areas,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <Text variant="heading">{t('plan.setupTitle')}</Text>
        <Text color="textMuted">{t('plan.setupDescription')}</Text>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          {t('plan.goal')}
        </Text>
        <Card>
          {GOALS.map((option, index) => (
            <Fragment key={option}>
              {index > 0 && <Divider />}
              <ListRow
                title={t(`goals.${option}`)}
                onPress={() => setGoal(option)}
                showChevron={false}
                right={
                  option === goal ? (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      tintColor={theme.text}
                      size={20}
                    />
                  ) : null
                }
              />
            </Fragment>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          {t('plan.days')}
        </Text>
        <SegmentedControl
          value={days}
          onChange={setDays}
          options={DAYS_PER_WEEK.map((value) => ({ value: String(value), label: String(value) }))}
        />
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          {t('plan.minutes')}
        </Text>
        <SegmentedControl
          value={minutes}
          onChange={setMinutes}
          options={SESSION_MINUTES.map((value) => ({ value: String(value), label: String(value) }))}
        />
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          {t('plan.experience')}
        </Text>
        <SegmentedControl
          value={experience}
          onChange={setExperience}
          options={EXPERIENCE_LEVELS.map((value) => ({ value, label: t(`plan.${value}`) }))}
        />
      </View>

      <View style={styles.section}>
        <Text variant="label" color="textMuted">
          {t('plan.areas')}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('plan.areasHint')}
        </Text>
        <BodyMap value={areas} onChange={setAreas} />
      </View>

      <Pressable accessibilityRole="link" onPress={() => router.push('/health')} style={styles.link}>
        <Text variant="label" color="textMuted">
          {t('plan.healthLink')}
        </Text>
      </Pressable>

      <Button label={t('plan.create')} onPress={create} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xl,
    paddingBottom: space.xl,
  },
  intro: {
    gap: space.sm,
  },
  section: {
    gap: space.sm,
  },
  link: {
    minHeight: touch.min,
    justifyContent: 'center',
  },
});
