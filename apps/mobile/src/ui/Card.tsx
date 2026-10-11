import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation, radius, space } from './theme';
import { useColorMode } from './ThemeMode';
import { useTheme } from './useTheme';

/** A rounded surface that groups related content. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const mode = useColorMode();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, boxShadow: elevation[mode] }, style]}>
      {children}
    </View>
  );
}

/** Thin line between rows inside a Card. */
export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
