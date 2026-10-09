import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useTheme } from './useTheme';

/** Small pill button for quick choices (e.g. presets). */
export function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: theme.surfaceMuted },
        pressed && styles.pressed,
      ]}>
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touch.min - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
