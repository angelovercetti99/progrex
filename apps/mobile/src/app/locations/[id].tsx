import {
  EQUIPMENT_TYPES,
  isLoadedEquipment,
  type EquipmentType,
  type LocationEquipment,
} from '@progrex/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LOCATION_PRESETS, type LocationPreset } from '@/features/locations/presets';
import { createLocation, deleteLocation, getLocation, updateLocation } from '@/features/locations/queries';
import { confirm } from '@/lib/confirm';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CheckRow } from '@/ui/CheckRow';
import { Chip } from '@/ui/Chip';
import { Stepper } from '@/ui/Stepper';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Weight steps when setting "up to X kg". */
const MAX_KG_STEP: Partial<Record<EquipmentType, number>> = { dumbbells: 2, kettlebells: 4, barbell: 10 };

/** Equipment as a map (type → max kg or null) — easier to toggle than a list. */
type EquipmentState = Partial<Record<EquipmentType, number | null>>;

function toState(equipment: LocationEquipment): EquipmentState {
  return Object.fromEntries(equipment.map((item) => [item.type, item.maxKg ?? null]));
}

function toList(state: EquipmentState): LocationEquipment {
  return EQUIPMENT_TYPES.filter((type) => type in state).map((type) => {
    const maxKg = state[type];
    return maxKg ? { type, maxKg } : { type };
  });
}

/** Create (`/locations/new`) or edit (`/locations/<id>`) a place. */
export default function LocationFormScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentState>({});

  useEffect(() => {
    if (isNew) return;
    getLocation(id).then((location) => {
      if (!location) return;
      setName(location.name);
      setEquipment(toState(location.equipment));
    });
  }, [id, isNew]);

  function applyPreset(preset: LocationPreset) {
    setEquipment(toState(LOCATION_PRESETS[preset]));
    const presetName = t(
      `locations.preset${preset[0].toUpperCase()}${preset.slice(1)}` as 'locations.presetGym'
    );
    setName((current) => current || presetName);
  }

  function toggle(type: EquipmentType) {
    setEquipment((current) => {
      const next = { ...current };
      if (type in next) {
        delete next[type];
      } else {
        next[type] = null;
      }
      return next;
    });
  }

  function setMaxKg(type: EquipmentType, value: number) {
    setEquipment((current) => ({ ...current, [type]: value || null }));
  }

  async function save() {
    const finalName = name.trim() || t('locations.new');
    if (isNew) {
      await createLocation(finalName, toList(equipment));
    } else {
      await updateLocation(id, finalName, toList(equipment));
    }
    router.back();
  }

  async function remove() {
    if (await confirm(t('locations.deleteConfirm'), t('common.delete'), t('common.cancel'))) {
      await deleteLocation(id);
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: isNew ? t('locations.new') : t('locations.edit') }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.section}>
            <Text variant="label" color="textMuted">
              {t('locations.name')}
            </Text>
            <TextField value={name} onChangeText={setName} placeholder={t('locations.namePlaceholder')} />
          </View>

          {isNew && (
            <View style={styles.section}>
              <Text variant="label" color="textMuted">
                {t('locations.presets')}
              </Text>
              <View style={styles.chips}>
                <Chip label={t('locations.presetGym')} onPress={() => applyPreset('gym')} />
                <Chip label={t('locations.presetHome')} onPress={() => applyPreset('home')} />
                <Chip label={t('locations.presetHotel')} onPress={() => applyPreset('hotel')} />
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text variant="label" color="textMuted">
              {t('locations.equipment')}
            </Text>
            <Card style={styles.checklist}>
              {EQUIPMENT_TYPES.map((type) => (
                <CheckRow
                  key={type}
                  label={t(`equipment.${type}`)}
                  checked={type in equipment}
                  onToggle={() => toggle(type)}>
                  {isLoadedEquipment(type) && (
                    <Stepper
                      label={t('locations.upTo')}
                      value={equipment[type] ?? 0}
                      step={MAX_KG_STEP[type] ?? 2}
                      max={500}
                      onChange={(value) => setMaxKg(type, value)}
                      unit={equipment[type] ? t('common.kg') : undefined}
                      format={(value) => (value === 0 ? t('locations.noLimit') : String(value))}
                    />
                  )}
                </CheckRow>
              ))}
            </Card>
            <Text variant="caption" color="textMuted">
              {t('locations.equipmentHint')}
            </Text>
          </View>

          <View style={styles.section}>
            <Button label={t('common.save')} onPress={save} />
            {!isNew && <Button variant="secondary" label={t('common.delete')} onPress={remove} />}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
    paddingBottom: space.xxxl,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  checklist: {
    paddingVertical: space.sm,
  },
});
