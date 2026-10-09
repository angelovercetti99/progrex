import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatNumber } from './Stepper';
import { Text } from './Text';
import { radius, space } from './theme';
import { useTheme } from './useTheme';

type BigStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
};

const BUTTON = 60;

/**
 * The main numbers of a set (weight, reps), big enough to read at arm's length
 * between sets: ( − )   20 kg   ( + )
 */
export function BigStepper({ label, value, onChange, step = 1, min = 0, max = 999, unit }: BigStepperProps) {
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
    <View style={styles.container}>
      <Text variant="caption" color="textMuted" align="center">
        {label}
      </Text>
      <View style={styles.row}>
        <RoundButton
          symbol="−"
          label="decrease"
          onPress={() => change(-step)}
          disabled={value - step < min}
          background={theme.surfaceMuted}
        />
        <View style={styles.value}>
          <Text variant="display" numeric>
            {formatNumber(value)}
          </Text>
          {unit ? (
            <Text variant="heading" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </View>
        <RoundButton
          symbol="+"
          label="increase"
          onPress={() => change(step)}
          disabled={value + step > max}
          background={theme.surfaceMuted}
        />
      </View>
    </View>
  );
}

type RoundButtonProps = {
  symbol: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  background: string;
};

function RoundButton({ symbol, label, onPress, disabled, background }: RoundButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Text variant="title" style={styles.symbol}>
        {symbol}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.xs,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontWeight: '400',
    lineHeight: 34,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  disabled: {
    opacity: 0.3,
  },
});
