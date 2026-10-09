import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useTheme } from './useTheme';

type StepperProps = {
  label: string;
  /** Small explanation under the label. */
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** e.g. "kg". */
  unit?: string;
  /** Custom display, e.g. 0 → "no limit". */
  format?: (value: number) => string;
};

/**
 * Label on the left, − value + on the right: change a number without the
 * keyboard (one hand, mid-workout). Values are rounded to avoid float noise
 * (0.1 + 0.2 = 0.30000000000000004).
 */
export function Stepper({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  format = formatNumber,
}: StepperProps) {
  const theme = useTheme();

  function change(delta: number) {
    const next = Math.round((value + delta) * 100) / 100;
    if (next < min || next > max) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onChange(next);
  }

  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <Text color="textMuted">{label}</Text>
        {hint ? (
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={[styles.control, { backgroundColor: theme.surfaceMuted }]}>
        <StepButton symbol="−" onPress={() => change(-step)} disabled={value - step < min} />
        <View style={styles.valueBox}>
          <Text variant="heading" numeric>
            {format(value)}
          </Text>
          {unit ? (
            <Text variant="caption" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </View>
        <StepButton symbol="+" onPress={() => change(step)} disabled={value + step > max} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  onPress,
  disabled,
}: {
  symbol: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={symbol === '+' ? 'increase' : 'decrease'}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text variant="heading">{symbol}</Text>
    </Pressable>
  );
}

/** 22.5 → "22.5", 20 → "20" */
export function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  label: {
    flex: 1,
  },
  control: {
    width: 188,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: touch.primary,
  },
  button: {
    width: touch.primary,
    height: touch.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
  },
  pressed: {
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.25,
  },
});
