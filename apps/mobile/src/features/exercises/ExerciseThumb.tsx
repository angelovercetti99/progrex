import { exerciseDemo } from '@progrex/shared';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import type { Exercise } from '@/db/schema';
import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { ExerciseDemoView } from './ExerciseDemoView';

/**
 * A small still picture of the exercise (the stick figure in its key
 * position), so lists can be scanned at a glance. Custom exercises, which
 * have no demo, show a dumbbell.
 */
export function ExerciseThumb({
  exercise,
  size = 52,
}: {
  exercise: Pick<Exercise, 'nameKey'> | null;
  size?: number;
}) {
  const theme = useTheme();
  const demo = exerciseDemo(exercise?.nameKey);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, backgroundColor: theme.surfaceMuted }]}>
      {demo ? (
        <ExerciseDemoView demo={demo} still />
      ) : (
        <SymbolView
          name={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }}
          tintColor={theme.textMuted}
          size={size * 0.42}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
