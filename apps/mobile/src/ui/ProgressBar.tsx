import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { radius } from './theme';
import { useTheme } from './useTheme';

/**
 * A thin bar that fills from 0 to 1, animating when the value changes.
 * Reanimated runs the animation on the UI thread, so it stays smooth even
 * while JavaScript is busy.
 */
export function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value)), { duration: 500 });
  }, [progress, value]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
