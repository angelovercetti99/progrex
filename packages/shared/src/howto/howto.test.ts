import { describe, expect, it } from 'vitest';

import { CATALOG } from '../catalog';
import { EXERCISE_DEMOS, exerciseDemo } from './demos';
import {
  BODY,
  demoBounds,
  demoDuration,
  distance,
  FLOOR_Y,
  poseAt,
  solveLimb,
  solvePose,
  VIEW,
  type Figure,
  type Point,
  type Pose,
} from './figure';

const pair = <T>(value: T | [T, T]): [T, T] => (Array.isArray(value) ? value : [value, value]);

/** Every frame of a demo, a few per second. */
function frames(key: string): Figure[] {
  const demo = EXERCISE_DEMOS[key];
  const total = demoDuration(demo);
  const result: Figure[] = [];
  for (let t = 0; t < total; t += 0.1) result.push(solvePose(poseAt(demo, t), demo.view));
  return result;
}

function allPoints(figure: Figure): Point[] {
  return [
    figure.head,
    figure.shoulder,
    figure.hip,
    ...figure.elbows,
    ...figure.hands,
    ...figure.knees,
    ...figure.ankles,
    ...figure.toes,
  ];
}

describe('exercise demos', () => {
  it('has a demo for every built-in exercise', () => {
    const missing = CATALOG.filter((exercise) => !EXERCISE_DEMOS[exercise.key]).map((e) => e.key);
    expect(missing).toEqual([]);
  });

  it('only has demos for exercises that exist', () => {
    const keys = new Set(CATALOG.map((exercise) => exercise.key));
    expect(Object.keys(EXERCISE_DEMOS).filter((key) => !keys.has(key))).toEqual([]);
  });

  it('returns nothing for custom exercises', () => {
    expect(exerciseDemo(null)).toBeNull();
    expect(exerciseDemo('my_own_exercise')).toBeNull();
    expect(exerciseDemo('push_up')).not.toBeNull();
  });

  // If a hand or foot can't reach where a pose puts it, the arm or leg is
  // too short for that pose: it would float off the bar, the floor or the bench.
  it('reaches every hand and foot position in every key pose', () => {
    for (const [key, demo] of Object.entries(EXERCISE_DEMOS)) {
      demo.poses.forEach((pose: Pose, index) => {
        const figure = solvePose(pose, demo.view);
        const hands = pair(pose.hands);
        const feet = pair(pose.feet);
        for (const side of [0, 1]) {
          expect(distance(figure.hands[side], hands[side]), `${key} pose ${index} hand`).toBeLessThan(0.5);
          expect(distance(figure.ankles[side], feet[side]), `${key} pose ${index} foot`).toBeLessThan(0.5);
        }
      });
    }
  });

  it('keeps every arm and leg the same length while moving', () => {
    for (const key of Object.keys(EXERCISE_DEMOS)) {
      for (const figure of frames(key)) {
        for (const side of [0, 1]) {
          expect(distance(figure.shoulders[side], figure.elbows[side]), key).toBeCloseTo(BODY.upperArm, 3);
          expect(distance(figure.elbows[side], figure.hands[side]), key).toBeCloseTo(BODY.forearm, 3);
          expect(distance(figure.hips[side], figure.knees[side]), key).toBeCloseTo(BODY.thigh, 3);
          expect(distance(figure.knees[side], figure.ankles[side]), key).toBeCloseTo(BODY.shin, 3);
        }
      }
    }
  });

  it('stays inside the picture and never sinks into the floor', () => {
    for (const key of Object.keys(EXERCISE_DEMOS)) {
      for (const figure of frames(key)) {
        for (const point of allPoints(figure)) {
          expect(point.x, key).toBeGreaterThanOrEqual(VIEW.x);
          expect(point.x, key).toBeLessThanOrEqual(VIEW.x + VIEW.width);
          expect(point.y, key).toBeGreaterThanOrEqual(VIEW.y);
          expect(point.y, key).toBeLessThanOrEqual(FLOOR_Y + 2.5);
        }
        // The head is a circle: all of it must stay above the floor.
        expect(figure.head.y + BODY.headRadius, key).toBeLessThanOrEqual(FLOOR_Y + 1);
      }
    }
  });
});

describe('demo framing', () => {
  it('fits every demo in a box inside the picture, floor included', () => {
    for (const [key, demo] of Object.entries(EXERCISE_DEMOS)) {
      const box = demoBounds(demo);
      expect(box.x, key).toBeGreaterThanOrEqual(VIEW.x);
      expect(box.y, key).toBeGreaterThanOrEqual(VIEW.y);
      expect(box.x + box.width, key).toBeLessThanOrEqual(VIEW.x + VIEW.width);
      expect(box.y + box.height, key).toBeGreaterThanOrEqual(FLOOR_Y);
      for (const figure of frames(key)) {
        expect(figure.head.y - BODY.headRadius, key).toBeGreaterThanOrEqual(box.y);
      }
    }
  });

  it('crops away the empty sky above a figure lying down', () => {
    expect(demoBounds(EXERCISE_DEMOS.glute_bridge).height).toBeLessThan(VIEW.height / 2);
  });
});

describe('figure', () => {
  it('bends knees forward and elbows backward, like a real body', () => {
    const figure = solvePose({
      hip: { x: 50, y: 60 },
      lean: 0,
      hands: { x: 55, y: 45 },
      feet: { x: 50, y: 98 },
    });
    expect(figure.knees[0].x).toBeGreaterThan(50);
    expect(figure.elbows[0].x).toBeLessThan(figure.shoulder.x + 1);
  });

  it('straightens a limb towards a target that is out of reach', () => {
    const { end } = solveLimb({ x: 0, y: 0 }, { x: 0, y: 100 }, 16, 15, 1);
    expect(end.y).toBeCloseTo(31, 1);
    expect(end.x).toBeCloseTo(0, 1);
  });

  it('lets a pose move at its own speed (negatives: up fast, down slowly)', () => {
    const [bottom, top] = EXERCISE_DEMOS.negative_pull_up.poses;
    expect(top.move).toBeGreaterThan(bottom.move ?? 0);
    const demo = {
      poses: [
        { ...bottom, hold: 0, move: 1 },
        { ...top, hold: 0, move: 3 },
      ],
    };
    expect(demoDuration(demo)).toBe(4);
    // Halfway through the slow lowering, the figure is halfway down.
    expect(poseAt(demo, 2.5).hip.y).toBeCloseTo((bottom.hip.y + top.hip.y) / 2, 5);
  });

  it('loops: starts and ends on the first pose, pausing on each one', () => {
    const demo = EXERCISE_DEMOS.push_up;
    expect(poseAt(demo, 0)).toEqual(demo.poses[0]);
    expect(poseAt(demo, demoDuration(demo))).toEqual(demo.poses[0]);
    expect(poseAt(demo, demoDuration(demo) / 2)).toEqual(demo.poses[1]);
  });
});
