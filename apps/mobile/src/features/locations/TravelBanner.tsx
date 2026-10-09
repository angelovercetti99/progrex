import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate } from '@/lib/dates';
import { setTravel } from '@/lib/preferences';
import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import type { TravelState } from './queries';

/** The dark strip on Today while travelling: where, until when, and a way out. */
export function TravelBanner({ travel }: { travel: TravelState }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: theme.accent }]}>
      <View style={styles.texts}>
        <Text variant="label" color="onAccent">
          {t('travel.banner', { place: travel.location.name })}
        </Text>
        <Text variant="caption" color="onAccent" style={styles.muted}>
          {t('travel.until', { date: formatShortDate(travel.until, i18n.language) })}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setTravel(null)} hitSlop={8} style={styles.end}>
        <Text variant="label" color="onAccent">
          {t('travel.end')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  muted: {
    opacity: 0.7,
  },
  end: {
    minHeight: touch.min - 8,
    justifyContent: 'center',
  },
});
