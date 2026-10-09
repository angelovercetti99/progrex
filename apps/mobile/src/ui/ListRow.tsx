import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { space, touch } from './theme';
import { useTheme } from './useTheme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Shown on the right, before the chevron. */
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  /** Hide the › (e.g. in pick-one lists, where a tap selects instead of opening). */
  showChevron?: boolean;
};

/** A tappable row: title (+ subtitle) on the left, value and › on the right. */
export function ListRow({ title, subtitle, value, right, onPress, showChevron = true }: ListRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.texts}>
        <Text>{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text color="textMuted">{value}</Text> : null}
      {right}
      {onPress && showChevron ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          tintColor={theme.textMuted}
          size={16}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touch.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
