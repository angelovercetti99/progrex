import { StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from './Text';
import { useTheme } from './useTheme';

/**
 * The Progrex mark: a "P" whose stem is an upward arrow (Progrex + progress).
 * Same drawing as assets/brand/progrex-mark.svg, on a 1024 grid.
 */
export function LogoMark({ size = 32, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const fill = color ?? theme.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Progrex">
      <G transform="translate(512 512) scale(0.92) translate(-470 -480)">
        <Path
          d="M 292 792 V 330 H 214 L 354 168 L 494 330 H 416 V 792 Z"
          fill={fill}
          stroke={fill}
          strokeWidth={24}
          strokeLinejoin="round"
        />
        <Path
          d="M 416 382 H 560 A 118 118 0 0 1 560 618 H 416"
          fill="none"
          stroke={fill}
          strokeWidth={112}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

/** Mark + name, the full logo. `size` is the mark size; the name scales with it. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <View style={styles.lockup} accessibilityRole="header" accessibilityLabel="Progrex">
      <LogoMark size={size} />
      <Text
        style={[
          styles.word,
          { fontSize: size * 0.82, lineHeight: size, letterSpacing: -0.035 * size * 0.82 },
        ]}>
        Progrex
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  word: {
    fontWeight: '600',
  },
});
