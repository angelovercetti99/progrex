import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { DURATION } from './motion';
import { Text } from './Text';
import { typography, type ColorName, type TypographyVariant } from './theme';

type AnimatedNumberProps = {
  /** What to show ("22,5"). A new text rolls in. */
  text: string;
  /** 1 = the number went up (rolls in from below), -1 = down (from above). */
  direction?: 1 | -1;
  variant?: TypographyVariant;
  color?: ColorName;
};

/**
 * A number that rolls when it changes, like a mechanical counter: you see
 * that it changed, and which way, without reading it twice.
 */
export function AnimatedNumber({
  text,
  direction = 1,
  variant = 'display',
  color = 'text',
}: AnimatedNumberProps) {
  const entering = (direction > 0 ? FadeInUp : FadeInDown)
    .duration(DURATION.fast)
    .withInitialValues({ opacity: 0, transform: [{ translateY: direction > 0 ? 18 : -18 }] });
  return (
    <View style={[styles.clip, { height: typography[variant].lineHeight }]}>
      {/* A new key = a new element, so the entering animation runs on every change. */}
      <Animated.View key={text} entering={entering}>
        <Text variant={variant} color={color} numeric>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
