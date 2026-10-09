import { PATTERN_FAMILIES, type ProgressLever } from '@progrex/shared';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useExerciseName } from '@/features/exercises/useExerciseName';
import i18n from '@/i18n';
import { Card, Divider } from '@/ui/Card';
import { LineChart } from '@/ui/charts/LineChart';
import { SegmentBar } from '@/ui/charts/SegmentBar';
import { Sparkline } from '@/ui/charts/Sparkline';
import { TargetBar } from '@/ui/charts/TargetBar';
import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

import { PROGRESS_WEEKS, type ProgressOverview } from './queries';

/** Strength of each lever's shade: most used = strongest. */
const LEVER_OPACITY = [1, 0.7, 0.5, 0.35, 0.22, 0.12];

/** "+12,2%" in Portuguese, "+12.2%" in English. */
export function formatPercent(value: number, digits = 1): string {
  const pct = value * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const number = Math.abs(pct).toFixed(digits);
  return `${sign}${i18n.language === 'pt' ? number.replace('.', ',') : number}%`;
}

/** The Progress tab: one main number, then stimulus, movements and levers. */
export function ProgressView({ data }: { data: ProgressOverview }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const [howOpen, setHowOpen] = useState(false);

  // The place you trained most: weeks spent elsewhere get a filled dot.
  const counts = new Map<string, number>();
  data.weeks.forEach(
    (week) => week.locationId && counts.set(week.locationId, (counts.get(week.locationId) ?? 0) + 1)
  );
  const home = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const away = data.weeks.map((week) => week.locationId !== null && week.locationId !== home);

  const leverEntries = (Object.entries(data.levers) as [ProgressLever, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const leverTotal = leverEntries.reduce((sum, [, count]) => sum + count, 0);

  const stimulusMax = Math.max(
    8,
    ...PATTERN_FAMILIES.map((family) =>
      Math.max(data.stimulus.thisWeek[family], data.stimulus.usual?.[family] ?? 0)
    )
  );

  return (
    <View style={styles.container}>
      {/* 1. The Progrex Index */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="caption" color="textMuted" style={styles.flex}>
            {t('progress.index', { weeks: PROGRESS_WEEKS })}
          </Text>
          <Pressable hitSlop={12} onPress={() => setHowOpen((open) => !open)}>
            <Text variant="caption" color="textMuted">
              {t('progress.howTitle')}
            </Text>
          </Pressable>
        </View>
        <Text variant="display" numeric>
          {data.index === null ? t('progress.indexNone') : formatPercent(data.index)}
        </Text>
        <Text variant="caption" color="textMuted">
          {data.index === null ? t('progress.indexNoneHelp') : t('progress.indexHelp')}
        </Text>
        {howOpen && (
          <View style={[styles.how, { backgroundColor: theme.surfaceMuted }]}>
            <Text variant="caption" color="textMuted">
              {t('progress.howBody')}
            </Text>
          </View>
        )}
        <View style={styles.chart}>
          <LineChart values={data.weeks.map((week) => week.index)} highlight={away} />
        </View>
        <View style={styles.weekChips}>
          {data.weeks.map((week, index) => (
            <View
              key={week.start}
              style={[styles.weekChip, { backgroundColor: away[index] ? theme.text : theme.surfaceMuted }]}>
              <Text variant="caption" color={away[index] ? 'onAccent' : 'textMuted'} numberOfLines={1}>
                {week.locationId ? (data.locationNames.get(week.locationId) ?? '').slice(0, 1) : '·'}
              </Text>
            </View>
          ))}
        </View>
        {away.some(Boolean) && (
          <Text variant="caption" color="textMuted">
            {t('progress.legendAway')}
          </Text>
        )}
      </Card>

      {/* 2. Stimulus this week */}
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text variant="heading" style={styles.flex}>
            {t('progress.stimulusTitle')}
          </Text>
          {data.stimulus.ratio !== null && (
            <Text variant="heading" numeric>
              {Math.round(data.stimulus.ratio * 100)}%
            </Text>
          )}
        </View>
        <Text variant="caption" color="textMuted">
          {data.stimulus.locationId
            ? t('progress.stimulusAt', { place: data.locationNames.get(data.stimulus.locationId) ?? '' })
            : t('progress.stimulusHelp')}
        </Text>
        <View style={styles.bars}>
          {PATTERN_FAMILIES.map((family) => (
            <View key={family} style={styles.row}>
              <Text style={styles.familyLabel}>{t(`progress.families.${family}`)}</Text>
              <TargetBar
                value={data.stimulus.thisWeek[family]}
                target={data.stimulus.usual?.[family] ?? null}
                max={stimulusMax}
              />
              <Text variant="label" numeric style={styles.barValue}>
                {data.stimulus.thisWeek[family]}
                {data.stimulus.usual ? `/${data.stimulus.usual[family]}` : ''}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="caption" color="textMuted">
          {data.stimulus.usual ? t('progress.barLegend') : t('progress.stimulusNone')}
        </Text>
      </Card>

      {/* 3. By movement */}
      {data.patterns.length > 0 && (
        <Card style={styles.card}>
          <Text variant="heading">{t('progress.byMovement')}</Text>
          {data.patterns.map((pattern, index) => (
            <Fragment key={pattern.pattern}>
              {index > 0 && <Divider />}
              <View style={styles.patternRow}>
                <View style={styles.flex}>
                  <Text>{t(`patterns.${pattern.pattern}`)}</Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {pattern.exerciseIds
                      .map((id) => {
                        const exercise = data.exerciseNames.get(id);
                        return exercise ? exerciseName(exercise) : '';
                      })
                      .join(' · ')}
                  </Text>
                </View>
                <Sparkline values={pattern.series} />
                <Text variant="label" numeric style={styles.delta}>
                  {formatPercent(pattern.change, 0)}
                </Text>
              </View>
            </Fragment>
          ))}
        </Card>
      )}

      {/* 4. Levers */}
      {leverTotal > 0 && (
        <Card style={styles.card}>
          <Text variant="heading">{t('progress.leversTitle')}</Text>
          <Text variant="caption" color="textMuted">
            {t('progress.leversHelp', { weeks: PROGRESS_WEEKS })}
          </Text>
          <View style={styles.segment}>
            <SegmentBar
              parts={leverEntries.map(([, count], index) => ({
                value: count,
                opacity: LEVER_OPACITY[index],
              }))}
            />
          </View>
          {leverEntries.map(([lever, count], index) => (
            <View key={lever} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: theme.text, opacity: LEVER_OPACITY[index] }]} />
              <Text style={styles.flex}>{t(`progress.levers.${lever}`)}</Text>
              <Text variant="label" numeric>
                {Math.round((count / leverTotal) * 100)}%
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Pressable accessibilityRole="button" onPress={() => router.push('/history')} style={styles.textButton}>
        <Text variant="label" color="textMuted">
          {t('progress.seeAll')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
    paddingBottom: space.xl,
  },
  card: {
    paddingVertical: space.lg,
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  how: {
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.sm,
  },
  chart: {
    marginTop: space.md,
  },
  weekChips: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.sm,
  },
  weekChip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
    paddingVertical: 2,
  },
  bars: {
    gap: space.md,
    marginVertical: space.md,
  },
  familyLabel: {
    width: 84,
  },
  barValue: {
    width: 48,
    textAlign: 'right',
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  delta: {
    width: 52,
    textAlign: 'right',
  },
  segment: {
    marginVertical: space.md,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  textButton: {
    minHeight: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
