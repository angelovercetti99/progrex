import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DURATION } from './motion';
import { radius, space } from './theme';
import { useTheme } from './useTheme';

/**
 * One short bar per part (e.g. per exercise), each filling from 0 to 1.
 * Shows how far you are AND how the workout is split, in one line.
 */
export function SegmentedProgress({ values }: { values: number[] }) {
  return (
    <View style={styles.row}>
      {values.map((value, index) => (
        <Segment key={index} value={value} />
      ))}
    </View>
  );
}

function Segment({ value }: { value: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value)), { duration: DURATION.slow });
  }, [progress, value]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.xs,
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
