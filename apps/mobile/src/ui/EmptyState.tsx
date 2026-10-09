import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { space } from './theme';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

/** What a screen shows when there's nothing in it yet. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text variant="heading" align="center">
        {title}
      </Text>
      <Text color="textMuted" align="center" style={styles.description}>
        {description}
      </Text>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxxl,
  },
  description: {
    maxWidth: 320,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: space.xl,
  },
});
