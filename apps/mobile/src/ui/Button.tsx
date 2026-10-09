import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useTheme } from './useTheme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` = the ONE main action of the screen. Everything else is `secondary`. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  function handlePress() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: isPrimary ? theme.accent : theme.surfaceMuted },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text variant="label" color={isPrimary ? 'onAccent' : 'text'} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
