import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, space, touch } from './theme';
import { useTheme } from './useTheme';

type CheckRowProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Extra controls shown under the label when checked. */
  children?: ReactNode;
};

/** A checklist row: the whole row is the tap target. */
export function CheckRow({ label, checked, onToggle, children }: CheckRowProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View
          style={[
            styles.box,
            checked
              ? { backgroundColor: theme.accent, borderColor: theme.accent }
              : { borderColor: theme.border },
          ]}>
          {checked ? (
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              tintColor={theme.onAccent}
              size={16}
              weight="bold"
            />
          ) : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {checked && children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: space.xs,
  },
  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  extra: {
    paddingLeft: 24 + space.md,
    paddingBottom: space.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
