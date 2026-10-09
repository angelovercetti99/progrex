import { router } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { listLocations } from '@/features/locations/queries';
import { useEquipmentSummary } from '@/features/locations/useEquipmentSummary';
import { Button } from '@/ui/Button';
import { Card, Divider } from '@/ui/Card';
import { ListRow } from '@/ui/ListRow';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function LocationsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const summarize = useEquipmentSummary();
  const all = useLiveQuery(listLocations, ['locations'], []);
  const items = all.data ?? [];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.column}>
        {items.length > 0 && (
          <Card>
            {items.map((location, index) => (
              <Fragment key={location.id}>
                {index > 0 && <Divider />}
                <ListRow
                  title={location.name}
                  subtitle={summarize(location.equipment)}
                  onPress={() => router.push(`/locations/${location.id}`)}
                />
              </Fragment>
            ))}
          </Card>
        )}
        <Button
          variant={items.length ? 'secondary' : 'primary'}
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
});
