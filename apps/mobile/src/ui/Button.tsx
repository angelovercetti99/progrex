import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet } from 'react-native';

import { PressableScale } from './PressableScale';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useSingleFlight } from './useSingleFlight';
import { useTheme } from './useTheme';

type ButtonProps = {
  label: string;
  onPress: () => unknown;
  /** `primary` = the ONE main action of the screen. Everything else is `secondary`. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  const theme = useTheme();
  const run = useSingleFlight(onPress);
  const isPrimary = variant === 'primary';

  function handlePress() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    run();
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={handlePress}
      scaleTo={0.96}
      style={[
        styles.base,
        { backgroundColor: isPrimary ? theme.accent : theme.surfaceMuted },
        disabled && styles.disabled,
      ]}>
      <Text variant="label" face="display" color={isPrimary ? 'onAccent' : 'text'} style={styles.label}>
        {label}
      </Text>
    </PressableScale>
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
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.4,
  },
});
