/**
 * A stick figure seen from the side, facing right, for exercise demos.
 *
 * How it works: a demo is a few key poses (e.g. "standing" and "bottom of the
 * squat"). A pose says where the hips, hands and feet are, and how much the
 * torso leans. The elbows and knees are worked out with a tiny bit of geometry
 * (two-bone "inverse kinematics"), so arms and legs always keep their length,
 * even between key poses. Everything here is pure math: no React, no drawing.
 *
 * Coordinates: like SVG, x grows to the right and y grows DOWN. The floor is
 * at y = FLOOR_Y. A standing figure is about 100 units tall.
 */

export type Point = { x: number; y: number };

/** Something the figure holds or pushes, drawn where the hands, feet, etc. are. */
export type HeldProp = {
  kind: 'dumbbell' | 'kettlebell' | 'barbell' | 'pad';
  at: 'hands' | 'feet' | 'shoulders' | 'hips';
  /**
   * Only in one hand (one-arm exercises): `near` or `far`. Without it, loaded
   * equipment goes in both hands, except a barbell, which is drawn once.
   */
  hand?: 'near' | 'far';
  /** For `pad`: its direction in degrees (0 = vertical, 90 = horizontal). */
  angle?: number;
};

/** Fixed scenery: benches, bars, tables, cables. */
export type SceneProp =
  | { kind: 'box'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; from: Point; to: Point }
  /** A bar seen end-on (pull-up bar, dip bars). */
  | { kind: 'bar'; at: Point }
  /** A band or cable from a fixed point to the hands (or feet). */
  | { kind: 'cable'; from: Point; to: 'hands' | 'feet' };

export type Pose = {
  hip: Point;
  /** Torso angle from vertical, in degrees. 0 = upright, 90 = leaning fully forward. */
  lean: number;
  /** Where the hands are: one point (both together) or [near, far]. */
  hands: Point | [Point, Point];
  /** Where the ankles are: one point (both together) or [near, far]. */
  feet: Point | [Point, Point];
  /**
   * Direction of each foot, in degrees from straight down (90 = flat, toes
   * forward; 0 = toes pointing at the floor). One value or [near, far].
   */
  toes?: number | [number, number];
  /** Head tilt relative to the torso, in degrees (+ = chin down). */
  head?: number;
  /** Seconds to pause on this pose (default: the demo's `hold`). */
  hold?: number;
  /** Seconds to move from this pose to the next (default: the demo's `move`). E.g. a slow lowering. */
  move?: number;
};

export type ExerciseDemo = {
  /** Which pose to show as a still picture (lists, thumbnails). Default: the second, the "hard" part. */
  still?: number;
  /**
   * `side` (default): profile, facing right; index 0 = near limb, 1 = far limb.
   * `front`: facing the viewer, for sideways movements (lateral raises);
   * index 0 = left of the screen, 1 = right.
   */
  view?: 'side' | 'front';
  /** Two or more poses; the animation loops through them and back to the first. */
  poses: Pose[];
  props?: (HeldProp | SceneProp)[];
  /** Seconds to move between poses. */
  move?: number;
  /** Seconds to pause at each pose. */
  hold?: number;
};

/** The solved figure: every joint, ready to draw. Index 0 = near side, 1 = far side. */
export type Figure = {
  head: Point;
  neck: Point;
  /** Middle of the shoulders and of the hips (where the torso line starts and ends). */
  shoulder: Point;
  hip: Point;
  /** Each arm and leg starts here. Same point twice in the side view. */
  shoulders: [Point, Point];
  hips: [Point, Point];
  elbows: [Point, Point];
  hands: [Point, Point];
  knees: [Point, Point];
  ankles: [Point, Point];
  toes: [Point, Point];
};

export const FLOOR_Y = 100;
/** The visible area (an SVG viewBox). Room above the head for overhead arms and bars. */
export const VIEW = { x: 0, y: -20, width: 140, height: 125 } as const;

/** Body proportions (roughly a person 100 units tall). */
export const BODY = {
  torso: 30,
  neck: 3,
  headRadius: 6.5,
  upperArm: 16,
  forearm: 15,
  thigh: 23,
  shin: 22,
  foot: 7,
  /** Half the width of the shoulders and of the hips, for the front view. */
  shoulderHalf: 9,
  hipHalf: 5,
} as const;

export const ARM_LENGTH = BODY.upperArm + BODY.forearm;
export const LEG_LENGTH = BODY.thigh + BODY.shin;

const DEFAULT_MOVE = 1.1;
const DEFAULT_HOLD = 0.5;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** A unit vector at `degrees` from straight down, turning towards the front (right). */
function down(degrees: number): Point {
  return { x: Math.sin(toRad(degrees)), y: Math.cos(toRad(degrees)) };
}

function add(a: Point, b: Point, scale = 1): Point {
  return { x: a.x + b.x * scale, y: a.y + b.y * scale };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pair<T>(value: T | [T, T]): [T, T] {
  return Array.isArray(value) ? value : [value, value];
}

/**
 * Two-bone inverse kinematics: given the root (shoulder or hip), the target
 * (hand or ankle) and the two bone lengths, where does the middle joint go?
 * `bend` picks which side it bends to (+1 like an elbow, −1 like a knee).
 * Out of reach → the limb points straight at the target.
 */
export function solveLimb(
  root: Point,
  target: Point,
  upper: number,
  lower: number,
  bend: 1 | -1
): { joint: Point; end: Point } {
  const reach = distance(root, target);
  const length = Math.min(Math.max(reach, Math.abs(upper - lower) + 1e-6), upper + lower - 1e-6);
  const dir = reach > 0 ? { x: (target.x - root.x) / reach, y: (target.y - root.y) / reach } : { x: 0, y: 1 };
  // Law of cosines: the angle at the root between the limb's line and the upper bone.
  const cos = (upper * upper + length * length - lower * lower) / (2 * upper * length);
  const angle = Math.acos(Math.min(1, Math.max(-1, cos))) * bend;
  const upperDir = {
    x: dir.x * Math.cos(angle) - dir.y * Math.sin(angle),
    y: dir.x * Math.sin(angle) + dir.y * Math.cos(angle),
  };
  const joint = add(root, upperDir, upper);
  const toTarget = distance(joint, target);
  const end =
    toTarget > 0
      ? add(joint, { x: (target.x - joint.x) / toTarget, y: (target.y - joint.y) / toTarget }, lower)
      : joint;
  return { joint, end };
}

/** Where the torso points (from the hips to the shoulders), for a lean in degrees. */
function torsoDirection(lean: number): Point {
  return { x: Math.sin(toRad(lean)), y: -Math.cos(toRad(lean)) };
}

/** The pose's shoulder point, before solving the rest (handy to place the hands). */
export function shoulderOf(hip: Point, lean: number): Point {
  return add(hip, torsoDirection(lean), BODY.torso);
}

/** Turns a pose into joint positions. */
export function solvePose(pose: Pose, view: ExerciseDemo['view'] = 'side'): Figure {
  const torsoDir = torsoDirection(pose.lean);
  const shoulder = add(pose.hip, torsoDir, BODY.torso);
  const headAngle = toRad(pose.lean + (pose.head ?? 0));
  const headDir = { x: Math.sin(headAngle), y: -Math.cos(headAngle) };
  const neck = add(shoulder, headDir, BODY.neck);
  const head = add(neck, headDir, BODY.headRadius);

  // Front view: shoulders and hips get a width, and the two sides bend outwards.
  const front = view === 'front';
  const across = { x: -torsoDir.y, y: torsoDir.x };
  const widen = (center: Point, half: number): [Point, Point] =>
    front ? [add(center, across, -half), add(center, across, half)] : [center, center];
  const shoulders = widen(shoulder, BODY.shoulderHalf);
  const hips = widen(pose.hip, BODY.hipHalf);
  const elbowBend = (side: number): 1 | -1 => (front && side === 1 ? -1 : 1);
  const kneeBend = (side: number): 1 | -1 => (front && side === 0 ? 1 : -1);

  const hands = pair(pose.hands);
  const feet = pair(pose.feet);
  const toes = pair(pose.toes ?? (front ? [-75, 75] : 90));

  const arms = hands.map((hand, side) =>
    solveLimb(shoulders[side], hand, BODY.upperArm, BODY.forearm, elbowBend(side))
  );
  const legs = feet.map((foot, side) => solveLimb(hips[side], foot, BODY.thigh, BODY.shin, kneeBend(side)));
  const ankles = [legs[0].end, legs[1].end] as [Point, Point];

  return {
    head,
    neck,
    shoulder,
    hip: pose.hip,
    shoulders,
    hips,
    elbows: [arms[0].joint, arms[1].joint],
    hands: [arms[0].end, arms[1].end],
    knees: [legs[0].joint, legs[1].joint],
    ankles,
    toes: [add(ankles[0], down(toes[0]), BODY.foot), add(ankles[1], down(toes[1]), BODY.foot)],
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Blends two poses; t = 0 → a, t = 1 → b. */
export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const handsA = pair(a.hands);
  const handsB = pair(b.hands);
  const feetA = pair(a.feet);
  const feetB = pair(b.feet);
  // No toes on either pose = keep the default for the view (see solvePose).
  const toesA = pair(a.toes ?? 90);
  const toesB = pair(b.toes ?? 90);
  return {
    hip: lerpPoint(a.hip, b.hip, t),
    lean: lerp(a.lean, b.lean, t),
    hands: [lerpPoint(handsA[0], handsB[0], t), lerpPoint(handsA[1], handsB[1], t)],
    feet: [lerpPoint(feetA[0], feetB[0], t), lerpPoint(feetA[1], feetB[1], t)],
    toes:
      a.toes === undefined && b.toes === undefined
        ? undefined
        : [lerp(toesA[0], toesB[0], t), lerp(toesA[1], toesB[1], t)],
    head: lerp(a.head ?? 0, b.head ?? 0, t),
  };
}

/** Slow at both ends, like a real controlled rep. */
function ease(t: number): number {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/** Pause and move time of one pose (its own, or the demo's). */
function timing(demo: ExerciseDemo, pose: Pose): { hold: number; move: number } {
  return {
    hold: pose.hold ?? demo.hold ?? DEFAULT_HOLD,
    move: pose.move ?? demo.move ?? DEFAULT_MOVE,
  };
}

/** How long one full loop of the demo takes, in seconds. */
export function demoDuration(demo: ExerciseDemo): number {
  return demo.poses.reduce((total, pose) => {
    const { hold, move } = timing(demo, pose);
    return total + hold + move;
  }, 0);
}

/** The pose at a moment in time (loops forever). */
export function poseAt(demo: ExerciseDemo, seconds: number): Pose {
  const total = demoDuration(demo);
  let time = ((seconds % total) + total) % total;
  for (let index = 0; index < demo.poses.length; index++) {
    const from = demo.poses[index];
    const { hold, move } = timing(demo, from);
    if (time < hold) return from;
    if (time < hold + move) {
      const to = demo.poses[(index + 1) % demo.poses.length];
      return blendPoses(from, to, ease((time - hold) / move));
    }
    time -= hold + move;
  }
  return demo.poses[0];
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * The smallest box that holds the whole demo (every frame, plus scenery),
 * with a little margin: lets the picture fill its space instead of leaving
 * empty room above a figure lying on the floor.
 * With `pose`, just that one still pose (thumbnails): long poles and cables
 * are left out so the figure stays big.
 */
export function demoBounds(demo: ExerciseDemo, margin = 8, pose?: Pose): Box {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (p: Point, r = 0) => {
    xs.push(p.x - r, p.x + r);
    ys.push(p.y - r, p.y + r);
  };
  const total = demoDuration(demo);
  const figures: Figure[] = [];
  if (pose) figures.push(solvePose(pose, demo.view));
  else for (let t = 0; t <= total; t += 0.1) figures.push(solvePose(poseAt(demo, t), demo.view));
  for (const f of figures) {
    add(f.head, BODY.headRadius);
    for (const p of [f.shoulder, f.hip, ...f.elbows, ...f.hands, ...f.knees, ...f.ankles, ...f.toes])
      add(p, 2);
    // Room for what's held (a barbell plate is the biggest).
    for (const prop of demo.props ?? []) {
      if (prop.kind === 'barbell' || prop.kind === 'dumbbell' || prop.kind === 'kettlebell')
        add(f.hands[0], 9);
    }
  }
  for (const prop of demo.props ?? []) {
    if (prop.kind === 'box') {
      add({ x: prop.x, y: prop.y });
      add({ x: prop.x + prop.w, y: prop.y + prop.h });
    } else if (pose) {
      continue;
    } else if (prop.kind === 'line' || prop.kind === 'cable') {
      add(prop.from);
      if (prop.kind === 'line') add(prop.to);
    } else if (prop.kind === 'bar') {
      add(prop.at, 3);
    }
  }
  ys.push(FLOOR_Y);
  const minX = Math.max(VIEW.x, Math.min(...xs) - margin);
  const maxX = Math.min(VIEW.x + VIEW.width, Math.max(...xs) + margin);
  const minY = Math.max(VIEW.y, Math.min(...ys) - margin);
  const maxY = Math.min(VIEW.y + VIEW.height, Math.max(...ys) + margin / 2);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The still picture of a demo (see `still`). */
export function stillPose(demo: ExerciseDemo): Pose {
  return demo.poses[demo.still ?? 1] ?? demo.poses[0];
}
