import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '../useTheme';

type LineChartProps = {
  /** One value per point; null = no data yet (the line starts later). */
  values: (number | null)[];
  height?: number;
  /** Points to emphasise with a filled dot (e.g. weeks away from home). */
  highlight?: boolean[];
};

/**
 * A clean trend line in the Apple style: no axes, soft area underneath,
 * dots on each point. It measures its own width so it fills any card.
 */
export function LineChart({ values, height = 96, highlight = [] }: LineChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const pad = 6;

  const known = values.filter((value): value is number => value !== null);
  const min = Math.min(0, ...known);
  const max = Math.max(...known, min + 0.01);
  const x = (index: number) => pad + (index * (width - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (value: number) => height - pad - ((value - min) / (max - min)) * (height - 2 * pad);

  const points = values
    .map((value, index) => (value === null ? null : { index, value }))
    .filter((point): point is { index: number; value: number } => point !== null);
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.index)} ${y(p.value)}`).join(' ');
  const area =
    points.length > 1
      ? `${line} L ${x(points[points.length - 1].index)} ${height} L ${x(points[0].index)} ${height} Z`
      : '';

  return (
    <View
      style={{ height }}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {area ? <Path d={area} fill={theme.text} opacity={0.06} /> : null}
          {points.length > 1 ? (
            <Path
              d={line}
              fill="none"
              stroke={theme.text}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {points.map((p) => (
            <Circle
              key={p.index}
              cx={x(p.index)}
              cy={y(p.value)}
              r={highlight[p.index] ? 5 : 3}
              fill={highlight[p.index] ? theme.text : theme.surface}
              stroke={theme.text}
              strokeWidth={2}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}
