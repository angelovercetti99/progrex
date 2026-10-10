import {
  BODY,
  FLOOR_Y,
  poseAt,
  solvePose,
  VIEW,
  type ExerciseDemo,
  type Figure,
  type Point,
} from '@progrex/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '@/ui/useTheme';

const STROKE = 3.5;
/** Far-side arm and leg: drawn fainter, so the near side reads first. */
const FAR_OPACITY = 0.3;

/**
 * Seconds since the demo appeared, updated about 30 times per second.
 *
 * Why not Reanimated here: the pose math lives in `packages/shared` as plain
 * functions (so it can be tested), and Reanimated can only run special
 * "worklet" functions on its animation thread. A stick figure is cheap to
 * redraw, so a simple timer + React state is enough.
 */
function useSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let start: number | null = null;
    let last = 0;
    const tick = (now: number) => {
      start ??= now;
      if (now - last > 33) {
        last = now;
        setSeconds((now - start) / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return seconds;
}

/** A looping stick-figure demo. With "reduce motion" on, the key poses side by side. */
export function ExerciseDemoView({ demo }: { demo: ExerciseDemo }) {
  const reduceMotion = useReducedMotion();
  const seconds = useSeconds(!reduceMotion);

  if (reduceMotion) {
    return (
      <View style={styles.row}>
        {demo.poses.map((pose, index) => (
          <View key={index} style={styles.flex}>
            <FigureDrawing demo={demo} figure={solvePose(pose, demo.view)} />
          </View>
        ))}
      </View>
    );
  }
  return <FigureDrawing demo={demo} figure={solvePose(poseAt(demo, seconds), demo.view)} />;
}

function FigureDrawing({ demo, figure }: { demo: ExerciseDemo; figure: Figure }) {
  const theme = useTheme();
  const front = demo.view === 'front';
  const props = demo.props ?? [];
  const farOpacity = front ? 1 : FAR_OPACITY;

  const limb = (points: Point[], opacity = 1) => (
    <Polyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="none"
      stroke={theme.text}
      strokeOpacity={opacity}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

  const midHands = {
    x: (figure.hands[0].x + figure.hands[1].x) / 2,
    y: (figure.hands[0].y + figure.hands[1].y) / 2,
  };

  return (
    <Svg
      width="100%"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      style={{ aspectRatio: VIEW.width / VIEW.height }}>
      <Line
        x1={VIEW.x}
        y1={FLOOR_Y}
        x2={VIEW.x + VIEW.width}
        y2={FLOOR_Y}
        stroke={theme.border}
        strokeWidth={1.5}
      />

      {/* Scenery: benches, bars, cables. */}
      {props.map((prop, index) => {
        switch (prop.kind) {
          case 'box':
            return (
              <Rect
                key={index}
                x={prop.x}
                y={prop.y}
                width={prop.w}
                height={prop.h}
                fill="none"
                stroke={theme.textMuted}
                strokeWidth={1.5}
              />
            );
          case 'line':
            return (
              <Line
                key={index}
                x1={prop.from.x}
                y1={prop.from.y}
                x2={prop.to.x}
                y2={prop.to.y}
                stroke={theme.textMuted}
                strokeWidth={2}
              />
            );
          case 'bar':
            return <Circle key={index} cx={prop.at.x} cy={prop.at.y} r={2.2} fill={theme.textMuted} />;
          case 'cable': {
            const to = prop.to === 'hands' ? figure.hands[0] : figure.ankles[0];
            return (
              <Line
                key={index}
                x1={prop.from.x}
                y1={prop.from.y}
                x2={to.x}
                y2={to.y}
                stroke={theme.textMuted}
                strokeWidth={1}
                strokeDasharray="3 2"
              />
            );
          }
          default:
            return null;
        }
      })}

      {/* Far side first, so the near side is drawn on top. */}
      {limb([figure.hips[1], figure.knees[1], figure.ankles[1], figure.toes[1]], farOpacity)}
      {limb([figure.shoulders[1], figure.elbows[1], figure.hands[1]], farOpacity)}
      {limb([figure.hip, figure.shoulder, figure.neck])}
      {front && limb([figure.shoulders[0], figure.shoulders[1]])}
      {front && limb([figure.hips[0], figure.hips[1]])}
      <Circle
        cx={figure.head.x}
        cy={figure.head.y}
        r={BODY.headRadius}
        fill="none"
        stroke={theme.text}
        strokeWidth={STROKE}
      />
      {limb([figure.hips[0], figure.knees[0], figure.ankles[0], figure.toes[0]])}
      {limb([figure.shoulders[0], figure.elbows[0], figure.hands[0]])}

      {/* What the figure holds or pushes. */}
      {props.map((prop, index) => {
        if (prop.kind === 'pad') {
          const at =
            prop.at === 'feet'
              ? figure.ankles[0]
              : prop.at === 'shoulders'
                ? figure.shoulder
                : figure.hands[0];
          const angle = ((prop.angle ?? 0) * Math.PI) / 180;
          const dx = 7 * Math.sin(angle);
          const dy = 7 * Math.cos(angle);
          return (
            <Line
              key={index}
              x1={at.x - dx}
              y1={at.y - dy}
              x2={at.x + dx}
              y2={at.y + dy}
              stroke={theme.textMuted}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        }
        if (prop.kind !== 'dumbbell' && prop.kind !== 'kettlebell' && prop.kind !== 'barbell') return null;
        const radius = prop.kind === 'barbell' ? 8 : prop.kind === 'kettlebell' ? 4.5 : 3.5;
        // A kettlebell hangs below the hand.
        const drop = prop.kind === 'kettlebell' ? 5 : 0;
        const places: { at: Point; opacity: number }[] =
          prop.at === 'hips'
            ? [{ at: figure.hip, opacity: 1 }]
            : prop.at === 'shoulders'
              ? [{ at: figure.shoulder, opacity: 1 }]
              : prop.at === 'feet'
                ? [{ at: figure.ankles[0], opacity: 1 }]
                : prop.kind === 'barbell'
                  ? [{ at: midHands, opacity: 1 }]
                  : prop.oneSide
                    ? [{ at: figure.hands[0], opacity: 1 }]
                    : [
                        { at: figure.hands[1], opacity: farOpacity },
                        { at: figure.hands[0], opacity: 1 },
                      ];
        return places.map(({ at, opacity }, side) => (
          <Circle
            key={`${index}-${side}`}
            cx={at.x}
            cy={at.y + drop}
            r={radius}
            fill={theme.surface}
            // Plates are big: leave them see-through so they don't hide the body.
            fillOpacity={opacity === 1 && prop.kind !== 'barbell' ? 1 : 0}
            stroke={theme.textMuted}
            strokeOpacity={opacity}
            strokeWidth={2}
          />
        ));
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
});
