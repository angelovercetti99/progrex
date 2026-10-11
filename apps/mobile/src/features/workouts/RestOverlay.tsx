import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { DURATION } from '@/ui/motion';
import { Text } from '@/ui/Text';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const RING = 240;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
/** "+15 s" adds this much rest. */
const EXTRA_STEP = 15;

type RestOverlayProps = {
  /** When the last set was completed (ISO). */
  since: string;
  targetSeconds: number;
  /** What comes next: the exercise, and "Set 2 · 60 kg × 8". */
  next: { title: string; detail: string };
  onClose: () => void;
};

/**
 * Between sets, the whole screen is the rest: a ring that empties, the time
 * left in big numbers, and what comes next. It closes by itself when the rest
 * is over (the phone buzzes, see RestTimer); "Skip" closes it now.
 */
export function RestOverlay({ since, targetSeconds, next, onClose }: RestOverlayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  const total = targetSeconds + extra;
  const elapsed = Math.max(0, (now - Date.parse(since)) / 1000);
  const left = Math.max(0, Math.ceil(total - elapsed));
  const progress = Math.min(1, elapsed / total);

  useEffect(() => {
    if (left === 0) onClose();
  }, [left, onClose]);

  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base)}
      exiting={FadeOut.duration(DURATION.base)}
      style={[styles.overlay, { backgroundColor: theme.background }]}>
      <Animated.View
        entering={FadeInDown.duration(DURATION.slow).springify().damping(16)}
        style={styles.column}>
        <Text variant="eyebrow" color="textMuted" align="center">
          {t('workout.rest')}
        </Text>

        <View style={styles.ring}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={theme.surfaceMuted}
              strokeWidth={STROKE}
              fill="none"
            />
            {/* The time left: a ring that empties clockwise, from the top. */}
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={theme.accent}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={CIRCUMFERENCE * progress}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <View style={styles.center}>
            <Text variant="display" numeric>
              {clock(left)}
            </Text>
            <Text variant="caption" color="textMuted" numeric>
              {t('workout.restOf', { time: clock(total) })}
            </Text>
          </View>
        </View>

        <View style={styles.next}>
          <Text variant="eyebrow" color="textMuted" align="center">
            {t('workout.upNext')}
          </Text>
          <Text variant="heading" align="center">
            {next.title}
          </Text>
          <Text color="textMuted" align="center" numeric>
            {next.detail}
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.chipRow}>
            <Chip
              label={t('workout.restMore', { seconds: EXTRA_STEP })}
              onPress={() => setExtra(extra + EXTRA_STEP)}
            />
          </View>
          <Button label={t('workout.skipRest')} onPress={onClose} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function clock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    padding: space.lg,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
  ring: {
    width: RING,
    height: RING,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  next: {
    gap: space.xs,
  },
  actions: {
    gap: space.md,
    marginTop: space.lg,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
