import { addDays } from '@progrex/shared';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { todayLocalDate } from '@/db/stamps';
import { getCurrentLocation, listLocations } from '@/features/locations/queries';
import { useEquipmentSummary } from '@/features/locations/useEquipmentSummary';
import { setCurrentLocationId, setTravel } from '@/lib/preferences';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Duration = 'always' | 'today' | 'days3' | 'week';

/** Days a temporary choice lasts (including today). */
const DAYS: Record<Exclude<Duration, 'always'>, number> = { today: 1, days3: 3, week: 7 };

/**
 * "Where are you training?" — pick the place, and for how long. Anything but
 * "Always" is a trip (travel mode): it ends by itself and your usual place
 * comes back.
 */
export default function SelectLocationScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const summarize = useEquipmentSummary();
  const all = useLiveQuery(listLocations, ['locations'], []);
  const current = useLiveQuery(getCurrentLocation, ['locations', 'preferences'], []);
  const [duration, setDuration] = useState<Duration>('always');

  async function choose(id: string) {
    if (duration === 'always') {
      await setTravel(null);
      await setCurrentLocationId(id);
    } else {
      await setTravel({ locationId: id, until: addDays(todayLocalDate(), DAYS[duration] - 1) });
    }
    router.back();
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        <View style={styles.section}>
          <Text variant="label" color="textMuted">
            {t('travel.duration')}
          </Text>
          <SegmentedControl<Duration>
            value={duration}
            onChange={setDuration}
            options={[
              { value: 'always', label: t('travel.always') },
              { value: 'today', label: t('travel.today') },
              { value: 'days3', label: t('travel.days3') },
              { value: 'week', label: t('travel.week') },
            ]}
          />
        </View>

        <Card>
          {(all.data ?? []).map((location, index) => (
            <Fragment key={location.id}>
              {index > 0 && <Divider />}
              <ListRow
                title={location.name}
                subtitle={summarize(location.equipment)}
                onPress={() => choose(location.id)}
                showChevron={false}
                right={
                  location.id === current.data?.id ? (
                    <SymbolView
                      name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                      tintColor={theme.accentText}
                      size={20}
                    />
                  ) : null
                }
              />
            </Fragment>
          ))}
        </Card>
        <Button
          variant="secondary"
          label={t('locations.new')}
          onPress={() => router.push('/locations/new')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
  },
  column: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
});
