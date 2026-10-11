import type { SetTarget } from '@progrex/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import type { WorkoutSet } from '@/db/schema';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const SIZE = 44;

type SetDotsProps = {
  /** Sets done today, in order. */
  done: WorkoutSet[];
  /** What's still planned after them. */
  remaining: SetTarget[];
  /** The set being edited, if any. */
  editingId: string | null;
  onEdit: (set: WorkoutSet) => void;
};

/**
 * Today's sets at a glance, one circle each, with the reps inside:
 * filled = done (tap to fix it), outlined = the one you're on, faint = to come.
 * Replaces a list of identical rows: the same information in one line.
 */
export function SetDots({ done, remaining, editingId, onEdit }: SetDotsProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {done.map((set, index) => {
        const editing = set.id === editingId;
        return (
          <Animated.View key={set.id} entering={ZoomIn.springify().damping(14)}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${t('workout.set')} ${index + 1}: ${set.reps} ${t('workout.reps')}`}
              onPress={() => onEdit(set)}
              scaleTo={0.9}
              style={[
                styles.dot,
                editing
                  ? { backgroundColor: theme.background, borderColor: theme.accent }
                  : { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}>
              <Text variant="label" color={editing ? 'text' : 'onAccent'} numeric>
                {set.reps}
              </Text>
            </PressableScale>
          </Animated.View>
        );
      })}
      {remaining.map((planned, offset) => {
        const current = offset === 0 && editingId === null;
        return (
          <View
            key={`next-${done.length + offset}`}
            accessibilityLabel={`${t('workout.set')} ${done.length + offset + 1}: ${planned.reps} ${t('workout.reps')}`}
            style={[
              styles.dot,
              current
                ? { borderColor: theme.accent, borderWidth: 2.5 }
                : { borderColor: theme.border, borderStyle: 'dashed' },
            ]}>
            <Text variant="label" color={current ? 'text' : 'textMuted'} numeric>
              {planned.reps}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
