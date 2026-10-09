import { EFFORT_LEVELS, effortForRir, rirForEffort, type EffortLevel } from '@progrex/shared';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useLiveQuery } from '@/db/live';
import { getEffortIntroSeen, setEffortIntroSeen } from '@/lib/preferences';
import { Chip } from '@/ui/Chip';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type EffortPickerProps = {
  /** Reps in reserve currently selected. */
  rir: number;
  /** The target RIR for this set (keeps precision when the answer covers it). */
  targetRir: number;
  onChange: (rir: number) => void;
};

/**
 * "How was it?" in plain words — Easy / Good / Hard / All out — instead of
 * asking beginners for an RIR number. The first time, a short explanation.
 */
export function EffortPicker({ rir, targetRir, onChange }: EffortPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const introSeen = useLiveQuery(getEffortIntroSeen, ['preferences'], []);
  const [aboutOpen, setAboutOpen] = useState(false);
  const level = effortForRir(rir);
  const showIntro = aboutOpen || introSeen.data === false;

  async function dismiss() {
    setAboutOpen(false);
    await setEffortIntroSeen();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text color="textMuted">{t('effort.question')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('effort.about')}
          hitSlop={12}
          onPress={() => setAboutOpen((open) => !open)}>
          <SymbolView
            name={{ ios: 'info.circle', android: 'info', web: 'info' }}
            tintColor={theme.textMuted}
            size={18}
          />
        </Pressable>
      </View>

      {showIntro && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.intro, { backgroundColor: theme.surfaceMuted }]}>
          <Text variant="label">{t('effort.introTitle')}</Text>
          <Text variant="caption" color="textMuted">
            {t('effort.introBody')}
          </Text>
          <View style={styles.introAction}>
            <Chip raised label={t('effort.gotIt')} onPress={dismiss} />
          </View>
        </Animated.View>
      )}

      <SegmentedControl<EffortLevel>
        value={level}
        onChange={(next) => onChange(rirForEffort(next, targetRir))}
        options={EFFORT_LEVELS.map((value) => ({ value, label: t(`effort.${value}`) }))}
      />
      <Text variant="caption" color="textMuted" align="center">
        {t(`effort.${level}Hint`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  intro: {
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  introAction: {
    flexDirection: 'row',
    marginTop: space.sm,
  },
});
