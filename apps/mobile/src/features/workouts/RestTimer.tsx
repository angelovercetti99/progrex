import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/Text';
import { radius, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const HIDE_AFTER_SECONDS = 15 * 60;

/**
 * Counts up from the last completed set: "Rest 1:24 / 1:30".
 * Turns to the accent color once the target rest is reached: time to go.
 */
export function RestTimer({ since, targetSeconds }: { since: string | null; targetSeconds: number | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = since ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0;
  const done = since !== null && targetSeconds !== null && seconds >= targetSeconds;

  // Rest is over: a buzz, so you don't have to keep looking at the screen.
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasDone.current = done;
  }, [done]);

  if (!since || seconds > HIDE_AFTER_SECONDS) return null;

  return (
    <View style={[styles.pill, { backgroundColor: done ? theme.accent : theme.surfaceMuted }]}>
      <Text variant="label" color={done ? 'onAccent' : 'textMuted'}>
        {t('workout.rest')}
      </Text>
      <Text variant="label" numeric color={done ? 'onAccent' : 'text'}>
        {clock(seconds)}
        {targetSeconds !== null ? ` / ${clock(targetSeconds)}` : ''}
      </Text>
    </View>
  );
}

function clock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
});
