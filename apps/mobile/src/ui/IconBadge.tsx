import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { radius } from './theme';
import { useTheme } from './useTheme';

/** An icon in a soft rounded square, at the start of a row (place, settings…). */
export function IconBadge({ name, size = 40 }: { name: SymbolViewProps['name']; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: theme.surfaceMuted }]}>
      <SymbolView name={name} tintColor={theme.text} size={size * 0.5} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
