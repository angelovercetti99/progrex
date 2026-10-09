import { BODY_AREAS, MAX_PRIORITY_AREAS, type BodyArea } from '@progrex/shared';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { Text } from '@/ui/Text';
import { radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type BodyMapProps = {
  value: BodyArea[];
  onChange: (areas: BodyArea[]) => void;
};

/** Shapes of an abstract figure (viewBox 120 × 250), each tied to a body area. */
type Shape =
  | { kind: 'circle'; area: BodyArea | null; cx: number; cy: number; r: number }
  | { kind: 'rect'; area: BodyArea | null; x: number; y: number; w: number; h: number; rx: number };

const head: Shape = { kind: 'circle', area: null, cx: 60, cy: 20, r: 14 };
const shoulders: Shape[] = [
  { kind: 'circle', area: 'shoulders', cx: 33, cy: 56, r: 11 },
  { kind: 'circle', area: 'shoulders', cx: 87, cy: 56, r: 11 },
];
const arms: Shape[] = [
  { kind: 'rect', area: 'arms', x: 16, y: 70, w: 14, h: 62, rx: 7 },
  { kind: 'rect', area: 'arms', x: 90, y: 70, w: 14, h: 62, rx: 7 },
];

const FRONT: Shape[] = [
  head,
  ...shoulders,
  { kind: 'rect', area: 'chest', x: 41, y: 46, w: 38, h: 30, rx: 9 },
  { kind: 'rect', area: 'core', x: 43, y: 80, w: 34, h: 46, rx: 9 },
  ...arms,
  { kind: 'rect', area: 'legs', x: 42, y: 132, w: 17, h: 66, rx: 8 },
  { kind: 'rect', area: 'legs', x: 61, y: 132, w: 17, h: 66, rx: 8 },
  { kind: 'rect', area: null, x: 44, y: 202, w: 13, h: 44, rx: 6 },
  { kind: 'rect', area: null, x: 63, y: 202, w: 13, h: 44, rx: 6 },
];

const BACK: Shape[] = [
  head,
  ...shoulders,
  { kind: 'rect', area: 'back', x: 41, y: 46, w: 38, h: 58, rx: 9 },
  { kind: 'rect', area: 'glutes', x: 42, y: 108, w: 36, h: 24, rx: 11 },
  ...arms,
  { kind: 'rect', area: 'legs', x: 42, y: 136, w: 17, h: 62, rx: 8 },
  { kind: 'rect', area: 'legs', x: 61, y: 136, w: 17, h: 62, rx: 8 },
  { kind: 'rect', area: 'calves', x: 43, y: 202, w: 15, h: 44, rx: 7 },
  { kind: 'rect', area: 'calves', x: 62, y: 202, w: 15, h: 44, rx: 7 },
];

/**
 * "Which areas do you want to improve?" — tap the figure or the names.
 * Up to 3: prioritising everything is the same as prioritising nothing.
 */
export function BodyMap({ value, onChange }: BodyMapProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const full = value.length >= MAX_PRIORITY_AREAS;

  function toggle(area: BodyArea) {
    const selected = value.includes(area);
    if (!selected && full) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    onChange(selected ? value.filter((item) => item !== area) : [...value, area]);
  }

  function fill(area: BodyArea | null) {
    if (area === null) return theme.surfaceMuted;
    return value.includes(area) ? theme.text : theme.border;
  }

  function figure(shapes: Shape[], label: string) {
    return (
      <View style={styles.figure}>
        <Svg width={120} height={250} viewBox="0 0 120 250">
          {shapes.map((shape, index) => {
            const press = shape.area ? () => toggle(shape.area as BodyArea) : undefined;
            return shape.kind === 'circle' ? (
              <Circle
                key={index}
                cx={shape.cx}
                cy={shape.cy}
                r={shape.r}
                fill={fill(shape.area)}
                onPress={press}
              />
            ) : (
              <Rect
                key={index}
                x={shape.x}
                y={shape.y}
                width={shape.w}
                height={shape.h}
                rx={shape.rx}
                fill={fill(shape.area)}
                onPress={press}
              />
            );
          })}
        </Svg>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.figures}>
        {figure(FRONT, t('plan.front'))}
        {figure(BACK, t('plan.back'))}
      </View>
      <View style={styles.chips}>
        {BODY_AREAS.map((area) => {
          const selected = value.includes(area);
          return (
            <Pressable
              key={area}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled: !selected && full }}
              onPress={() => toggle(area)}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.text : theme.surfaceMuted },
                !selected && full && styles.disabled,
              ]}>
              <Text variant="label" color={selected ? 'onAccent' : 'text'}>
                {t(`areas.${area}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {full && (
        <Text variant="caption" color="textMuted" align="center">
          {t('plan.areasMax', { max: MAX_PRIORITY_AREAS })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.md,
  },
  figures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xxl,
  },
  figure: {
    alignItems: 'center',
    gap: space.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    justifyContent: 'center',
  },
  chip: {
    minHeight: touch.min - 8,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
