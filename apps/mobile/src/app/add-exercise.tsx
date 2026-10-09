import { hasEquipmentFor, MOVEMENT_PATTERNS } from '@progrex/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import type { Exercise } from '@/db/schema';
import { listExercises } from '@/features/exercises/queries';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { addExerciseToWorkout, getWorkoutDetail } from '@/features/workouts/queries';
import { ListRow } from '@/ui/ListRow';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** "Supino" matches "supino" and "Agachamento búlgaro" matches "bulgaro". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function AddExerciseScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [filter, setFilter] = useState<'available' | 'all'>('available');
  const [search, setSearch] = useState('');

  const all = useLiveQuery(listExercises, ['exercises'], []);
  const workout = useLiveQuery(() => getWorkoutDetail(workoutId), ['workouts', 'locations'], [workoutId]);
  const equipment = workout.data?.location?.equipment ?? [];

  const query = normalize(search.trim());
  const visible = (all.data ?? []).filter(
    (exercise) =>
      (filter === 'all' || hasEquipmentFor(exercise.equipment, equipment)) &&
      (!query || normalize(exerciseName(exercise)).includes(query))
  );

  // One section per movement pattern, easiest exercises first.
  const sections = MOVEMENT_PATTERNS.map((pattern) => ({
    title: t(`patterns.${pattern}`),
    data: visible
      .filter((exercise) => exercise.pattern === pattern)
      .sort((a, b) => a.difficulty - b.difficulty || exerciseName(a).localeCompare(exerciseName(b))),
  })).filter((section) => section.data.length > 0);

  function equipmentLabel(exercise: Exercise): string {
    if (exercise.equipment.length === 0) return t('common.bodyweight');
    return exercise.equipment.map((type) => t(`equipment.${type}`)).join(' + ');
  }

  async function add(exercise: Exercise) {
    await addExerciseToWorkout(workoutId, exercise.id);
    router.back();
  }

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      sections={sections}
      keyExtractor={(exercise) => exercise.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextField
            value={search}
            onChangeText={setSearch}
            placeholder={t('addExercise.search')}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'available', label: t('addExercise.available') },
              { value: 'all', label: t('addExercise.all') },
            ]}
          />
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text variant="label" color="textMuted" style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <View style={[styles.item, { backgroundColor: theme.surface }]}>
          <ListRow title={exerciseName(item)} subtitle={equipmentLabel(item)} onPress={() => add(item)} />
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        all.status === 'ready' ? (
          <Text color="textMuted" align="center" style={styles.empty}>
            {t('addExercise.noResults')}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: space.md,
    marginBottom: space.sm,
  },
  sectionTitle: {
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  item: {
    borderRadius: 14,
    paddingHorizontal: space.lg,
  },
  separator: {
    height: space.xs,
  },
  empty: {
    paddingVertical: space.xxl,
  },
});
