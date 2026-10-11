import { exerciseDemo } from '@progrex/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db/live';
import { ExerciseDemoView } from '@/features/exercises/ExerciseDemoView';
import { getExercise } from '@/features/exercises/queries';
import { useExerciseName } from '@/features/exercises/useExerciseName';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { maxContentWidth, space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** How to do an exercise: a looping demo and three short cues. */
export default function HowToScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const exerciseName = useExerciseName();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useLiveQuery(() => getExercise(id), ['exercises'], [id]).data;

  const key = exercise?.nameKey ?? null;
  const demo = exerciseDemo(key);
  // Cues are a list in the translation files; `returnObjects` gives it back as an array.
  const cues = key
    ? (t(`howTo.cues.${key}` as 'howTo.cues.push_up', { returnObjects: true }) as string[])
    : [];

  return (
    <>
      <Stack.Screen options={{ title: exercise ? exerciseName(exercise) : t('howTo.open') }} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        {demo && (
          // Decorative for screen readers: the cues below say the same in words.
          <Card style={styles.demo}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.figure}>
              <ExerciseDemoView demo={demo} />
            </View>
          </Card>
        )}
        <View style={styles.cues}>
          {cues.map((cue, index) => (
            <View key={index} style={styles.cue}>
              <Text variant="heading" numeric style={styles.number}>
                {index + 1}
              </Text>
              <Text style={styles.cueText}>{cue}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl,
    gap: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  demo: {
    paddingVertical: space.lg,
  },
  figure: {
    height: 260,
  },
  cues: {
    gap: space.lg,
  },
  cue: {
    flexDirection: 'row',
    gap: space.md,
  },
  number: {
    width: 24,
  },
  cueText: {
    flex: 1,
  },
});
