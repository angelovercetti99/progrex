import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useTheme } from './useTheme';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

/**
 * Pick one of a few options (2–4). Faster than a dropdown: one tap, all
 * choices visible. `<T extends string>` makes it work with any set of values
 * while keeping them typed (e.g. only 'system' | 'pt' | 'en').
 */
export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  const theme = useTheme();

  function select(next: T) {
    if (next === value) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onChange(next);
  }

  return (
    <View accessibilityRole="radiogroup" style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => select(option.value)}
            style={[styles.segment, selected && { backgroundColor: theme.raised }]}>
            <Text variant="label" color={selected ? 'text' : 'textMuted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: space.xs,
    gap: space.xs,
  },
  segment: {
    flex: 1,
    minHeight: touch.min,
    borderRadius: radius.md - space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
