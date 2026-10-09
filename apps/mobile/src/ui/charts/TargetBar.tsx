import { StyleSheet, View } from 'react-native';

import { radius } from '../theme';
import { useTheme } from '../useTheme';

type TargetBarProps = {
  value: number;
  /** Where "normal" is: drawn as a thin tick. */
  target: number | null;
  /** The value at the right end of the bar. */
  max: number;
};

/** A horizontal bar with a reference tick: "11 of your usual 12". */
export function TargetBar({ value, target, max }: TargetBarProps) {
  const theme = useTheme();
  const scale = Math.max(max, 1);
  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
      <View
        style={[styles.fill, { backgroundColor: theme.text, width: `${Math.min(1, value / scale) * 100}%` }]}
      />
      {target !== null && target > 0 && (
        <View
          style={[
            styles.tick,
            { backgroundColor: theme.text, left: `${Math.min(1, target / scale) * 100}%` },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 16,
    marginLeft: -1,
    opacity: 0.35,
  },
});
