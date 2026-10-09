import { StyleSheet, View } from 'react-native';

import { radius } from '../theme';
import { useTheme } from '../useTheme';

/**
 * One bar split into parts by size, e.g. how often each lever was used.
 * Monochrome: each part is the text color at a different strength.
 */
export function SegmentBar({ parts }: { parts: { value: number; opacity: number }[] }) {
  const theme = useTheme();
  const visible = parts.filter((part) => part.value > 0);
  return (
    <View style={styles.bar}>
      {visible.map((part, index) => (
        <View key={index} style={{ flex: part.value, backgroundColor: theme.text, opacity: part.opacity }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: 2,
  },
});
