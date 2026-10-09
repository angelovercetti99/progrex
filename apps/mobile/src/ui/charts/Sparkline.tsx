import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../useTheme';

/** A tiny trend line for list rows. */
export function Sparkline({
  values,
  width = 64,
  height = 26,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
}) {
  const theme = useTheme();
  const points = values
    .map((value, index) => (value === null ? null : { index, value }))
    .filter((point): point is { index: number; value: number } => point !== null);
  if (points.length < 2) return <Svg width={width} height={height} />;

  const min = Math.min(0, ...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value), min + 0.01);
  const x = (index: number) => (index * width) / Math.max(1, values.length - 1);
  const y = (value: number) => height - 2 - ((value - min) / (max - min)) * (height - 4);
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.index)} ${y(p.value)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Path
        d={d}
        fill="none"
        stroke={theme.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
