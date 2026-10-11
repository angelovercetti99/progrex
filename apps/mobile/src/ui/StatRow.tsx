import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { space } from './theme';
import { useTheme } from './useTheme';

/** A row of big numbers with a small label under each: "6 exercícios | 16 séries | 60 min". */
export function StatRow({ items }: { items: { value: string; label: string }[] }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
          <View style={styles.item}>
            <Text variant="stat" numeric>
              {item.value}
            </Text>
            <Text variant="caption" color="textMuted">
              {item.label}
            </Text>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  item: {
    flex: 1,
    gap: 2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: space.lg,
  },
});
