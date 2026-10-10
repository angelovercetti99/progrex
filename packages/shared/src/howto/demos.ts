import {
  BODY,
  FLOOR_Y,
  shoulderOf,
  type ExerciseDemo,
  type HeldProp,
  type Point,
  type SceneProp,
} from './figure';

/**
 * One looping demo per built-in exercise (keyed like the catalog).
 *
 * The figure faces right. Floor at y = 100; a standing figure has its hips at
 * y ≈ 54 and its head at y ≈ 10. Variants of the same movement share their
 * poses and only change what's held, which keeps this file short and the
 * movements consistent.
 */

// ---------- Small helpers ----------

/** Ankle height when the foot is flat on the floor. */
const ANKLE_Y = FLOOR_Y - 2;
const pt = (x: number, y: number): Point => ({ x, y });

/** Hands hanging straight down from the shoulders (arms relaxed). */
function hanging(hip: Point, lean: number, dx = 1): Point {
  const shoulder = shoulderOf(hip, lean);
  return pt(shoulder.x + dx, shoulder.y + 30.5);
}

/** Hands just in front of the shoulders (e.g. holding a bar on the chest). */
function atShoulders(hip: Point, lean: number, dx = 4, dy = 2): Point {
  const shoulder = shoulderOf(hip, lean);
  return pt(shoulder.x + dx, shoulder.y + dy);
}

/** Torso from a known shoulder towards a point: gives the hips and the lean. */
function torso(shoulder: Point, toward: Point): { hip: Point; lean: number } {
  const dx = toward.x - shoulder.x;
  const dy = toward.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  const hip = pt(shoulder.x + (dx / length) * BODY.torso, shoulder.y + (dy / length) * BODY.torso);
  // The lean is measured from the hips towards the shoulders.
  const lean = (Math.atan2(-dx, dy) * 180) / Math.PI;
  return { hip, lean };
}

/** Lying on the back (head on the left): keeps the head level with the floor. */
function lyingBack(shoulder: Point, toward: Point) {
  const { hip, lean } = torso(shoulder, toward);
  return { hip, lean, head: -90 - lean };
}

/**
 * Where the shoulders are for a straight body (planks, push-ups, rows) that
 * starts at the ankles and rises at `degrees` (0 = flat towards the right,
 * 90 = upright, more than 90 = leaning back).
 */
function bodyLine(ankle: Point, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180;
  const length = BODY.torso + BODY.thigh + BODY.shin - 0.1;
  return pt(ankle.x + Math.cos(rad) * length, ankle.y - Math.sin(rad) * length);
}

/** A straight body from the ankles, rising at `degrees`: gives the hips and the lean. */
function straightBody(ankle: Point, degrees: number) {
  return torso(bodyLine(ankle, degrees), ankle);
}

const held = (kind: HeldProp['kind'], at: HeldProp['at'] = 'hands', extra: Partial<HeldProp> = {}) =>
  ({ kind, at, ...extra }) satisfies HeldProp;
const box = (x: number, y: number, w: number, h = FLOOR_Y - y): SceneProp => ({ kind: 'box', x, y, w, h });
const line = (from: Point, to: Point): SceneProp => ({ kind: 'line', from, to });
const cable = (from: Point, to: 'hands' | 'feet' = 'hands'): SceneProp => ({ kind: 'cable', from, to });
const bar = (at: Point): SceneProp => ({ kind: 'bar', at });

const with_ = (demo: ExerciseDemo, ...props: ExerciseDemo['props'] & object): ExerciseDemo => ({
  ...demo,
  props: [...(demo.props ?? []), ...props],
});

// ---------- Squat ----------

const squatTop = pt(62, 53.5);
const squatBottom = pt(47, 78);
const squat: ExerciseDemo = {
  poses: [
    { hip: squatTop, lean: 0, hands: hanging(squatTop, 0), feet: pt(62, ANKLE_Y) },
    { hip: squatBottom, lean: 35, hands: pt(94, 54), feet: pt(62, ANKLE_Y) },
  ],
};

const goblet: ExerciseDemo = {
  poses: [
    { hip: squatTop, lean: 0, hands: atShoulders(squatTop, 0, 8, 10), feet: pt(62, ANKLE_Y) },
    { hip: pt(49, 78), lean: 25, hands: atShoulders(pt(49, 78), 25, 8, 9), feet: pt(62, ANKLE_Y) },
  ],
};

const barbellSquat = (front: boolean): ExerciseDemo => {
  const bottom = front ? pt(50, 78) : pt(46, 78);
  const bottomLean = front ? 22 : 38;
  // Front: hands on the bar at the collarbones, elbows forward. Back: bar on the upper back.
  const grip = front ? [1, -4] : [-2, 4];
  return {
    poses: [
      { hip: squatTop, lean: 3, hands: atShoulders(squatTop, 3, grip[0], grip[1]), feet: pt(62, ANKLE_Y) },
      {
        hip: bottom,
        lean: bottomLean,
        hands: atShoulders(bottom, bottomLean, grip[0], grip[1]),
        feet: pt(62, ANKLE_Y),
      },
    ],
    props: [held('barbell', front ? 'hands' : 'shoulders')],
  };
};

const pistolTop = pt(64, 54);
const pistolBottom = pt(50, 82);
const pistol: ExerciseDemo = {
  poses: [
    { hip: pistolTop, lean: 0, hands: pt(92, 30), feet: [pt(64, ANKLE_Y), pt(74, 92)] },
    { hip: pistolBottom, lean: 35, hands: pt(95, 55), feet: [pt(62, ANKLE_Y), pt(93, 85)] },
  ],
};

const assistedPistol: ExerciseDemo = {
  poses: [
    { hip: pt(66, 54), lean: 0, hands: pt(94, 36), feet: [pt(66, ANKLE_Y), pt(74, 92)] },
    { hip: pt(54, 80), lean: 28, hands: pt(94, 50), feet: [pt(66, ANKLE_Y), pt(90, 86)] },
  ],
  props: [line(pt(97, 20), pt(97, FLOOR_Y))],
};

// Leg press: lying back in the seat, pushing a platform with the feet.
const legPressHip = pt(45, 84);
const legPress: ExerciseDemo = {
  poses: [
    { hip: legPressHip, lean: -52, hands: pt(48, 82), feet: pt(64, 62), toes: 140 },
    { hip: legPressHip, lean: -52, hands: pt(48, 82), feet: pt(75, 52), toes: 140 },
  ],
  props: [line(pt(14, 66), pt(40, 92)), line(pt(40, 92), pt(62, 92)), held('pad', 'feet', { angle: 45 })],
};

// ---------- Hinge ----------

const hingeTop = pt(62, 53.5);
const rdlBottom = pt(54, 56);
const rdl: ExerciseDemo = {
  poses: [
    { hip: hingeTop, lean: 0, hands: hanging(hingeTop, 0, 2), feet: pt(62, ANKLE_Y) },
    { hip: rdlBottom, lean: 70, hands: hanging(rdlBottom, 70, -1), feet: pt(62, ANKLE_Y) },
  ],
};

const singleLegRdlBottom = pt(60, 56);
const singleLegRdl: ExerciseDemo = {
  poses: [
    {
      hip: hingeTop,
      lean: 0,
      hands: hanging(hingeTop, 0),
      feet: [pt(62, ANKLE_Y), pt(56, 92)],
      toes: [90, 40],
    },
    {
      hip: singleLegRdlBottom,
      lean: 85,
      hands: hanging(singleLegRdlBottom, 85),
      feet: [pt(62, ANKLE_Y), pt(17, 54)],
      toes: [90, 0],
    },
  ],
};

const goodMorningBottom = pt(56, 56);
const bandGoodMorning: ExerciseDemo = {
  poses: [
    { hip: hingeTop, lean: 0, hands: atShoulders(hingeTop, 0, -2, 4), feet: pt(62, ANKLE_Y) },
    {
      hip: goodMorningBottom,
      lean: 75,
      hands: atShoulders(goodMorningBottom, 75, -2, 4),
      feet: pt(62, ANKLE_Y),
    },
  ],
  props: [cable(pt(62, FLOOR_Y - 1))],
};

const swingBottom = pt(52, 58);
const kettlebellSwing: ExerciseDemo = {
  poses: [
    { hip: swingBottom, lean: 55, hands: pt(65, 69), feet: pt(64, ANKLE_Y) },
    { hip: hingeTop, lean: -4, hands: pt(90, 26), feet: pt(64, ANKLE_Y) },
  ],
  props: [held('kettlebell')],
  move: 0.7,
  hold: 0.15,
};

const deadliftBottom = pt(54, 74);
const deadlift: ExerciseDemo = {
  poses: [
    { hip: deadliftBottom, lean: 62, hands: pt(76, 90), feet: pt(68, ANKLE_Y) },
    { hip: pt(64, 54), lean: 0, hands: hanging(pt(64, 54), 0, 2), feet: pt(68, ANKLE_Y) },
  ],
  props: [held('barbell')],
};

// Lying on the back, heels on sliders: hips up, pull the heels in.
const slideShoulder = pt(32, 93);
const slidingLegCurl: ExerciseDemo = {
  poses: [
    { ...lyingBack(slideShoulder, pt(62, 84)), hands: pt(60, 97), feet: pt(102, 95), toes: 170 },
    { ...lyingBack(slideShoulder, pt(62, 79)), hands: pt(60, 97), feet: pt(80, 95), toes: 150 },
  ],
};

// Kneeling, feet held: lean forward as slowly as possible.
const nordicKnee = pt(50, 96);
const nordicAnkle = pt(28, 96);
const nordicLean = (degrees: number) => {
  const rad = (degrees * Math.PI) / 180;
  return pt(nordicKnee.x + Math.sin(rad) * BODY.thigh, nordicKnee.y - Math.cos(rad) * BODY.thigh);
};
const nordicCurl: ExerciseDemo = {
  poses: [
    {
      hip: nordicLean(0),
      lean: 0,
      hands: atShoulders(nordicLean(0), 0, 7, 10),
      feet: nordicAnkle,
      toes: -90,
    },
    { hip: nordicLean(55), lean: 55, hands: pt(108, 84), feet: nordicAnkle, toes: -90 },
  ],
  props: [held('pad', 'feet')],
  move: 2,
};

// Lying face down on the machine, curling the heels up.
const legCurlHip = pt(50, 76);
const legCurlMachine: ExerciseDemo = {
  poses: [
    { hip: legCurlHip, lean: 90, hands: pt(100, 82), feet: pt(8, 77), toes: 0 },
    { hip: legCurlHip, lean: 90, hands: pt(100, 82), feet: pt(28, 56), toes: -90 },
  ],
  props: [
    box(20, 80, 85, 6),
    line(pt(30, 86), pt(30, FLOOR_Y)),
    line(pt(95, 86), pt(95, FLOOR_Y)),
    held('pad', 'feet'),
  ],
};

// ---------- Lunge ----------

const handsOnHips = (hip: Point, lean: number) => atShoulders(hip, lean, 4, 26);

const reverseLunge: ExerciseDemo = {
  poses: [
    { hip: pt(62, 53.5), lean: 0, hands: handsOnHips(pt(62, 53.5), 0), feet: pt(62, ANKLE_Y) },
    {
      hip: pt(48, 76),
      lean: 5,
      hands: handsOnHips(pt(48, 76), 5),
      feet: [pt(62, ANKLE_Y), pt(22, 93)],
      toes: [90, 20],
    },
  ],
};

const splitSquat = (backFoot: Point, top: Point, bottom: Point, hands: 'hips' | 'hang'): ExerciseDemo => {
  const handsAt = (hip: Point) => (hands === 'hips' ? handsOnHips(hip, 3) : hanging(hip, 3));
  const backToes = backFoot.y < ANKLE_Y - 5 ? -100 : 20;
  return {
    poses: [
      { hip: top, lean: 3, hands: handsAt(top), feet: [pt(74, ANKLE_Y), backFoot], toes: [90, backToes] },
      {
        hip: bottom,
        lean: 3,
        hands: handsAt(bottom),
        feet: [pt(74, ANKLE_Y), backFoot],
        toes: [90, backToes],
      },
    ],
  };
};

const bench = box(8, 78, 28);
const bulgarian = (hands: 'hips' | 'hang') =>
  with_(splitSquat(pt(24, 75), pt(64, 57), pt(57, 76), hands), bench);

const stepBox = box(70, 84, 34);
const stepUp: ExerciseDemo = {
  poses: [
    { hip: pt(58, 54), lean: 15, hands: hanging(pt(58, 54), 15), feet: [pt(80, 82), pt(55, ANKLE_Y)] },
    { hip: pt(80, 39), lean: 0, hands: hanging(pt(80, 39), 0), feet: [pt(80, 82), pt(84, 74)] },
  ],
  props: [stepBox],
};

const walkingLunge: ExerciseDemo = {
  poses: [
    { hip: pt(50, 54), lean: 0, hands: hanging(pt(50, 54), 0), feet: pt(50, ANKLE_Y) },
    {
      hip: pt(62, 76),
      lean: 3,
      hands: hanging(pt(62, 76), 3),
      feet: [pt(82, ANKLE_Y), pt(42, 93)],
      toes: [90, 20],
    },
  ],
  props: [held('dumbbell')],
};

// ---------- Horizontal push ----------

/** Push-up between a top and a bottom body angle, hands and feet fixed. */
function pushUp(
  ankle: Point,
  toes: number,
  top: number,
  bottom: number,
  hands: Point | [Point, Point]
): ExerciseDemo {
  return {
    poses: [
      { ...straightBody(ankle, top), hands, feet: ankle, toes },
      { ...straightBody(ankle, bottom), hands, feet: ankle, toes },
    ],
  };
}

const floorAnkle = pt(22, 92);
const pushUpDemo = pushUp(floorAnkle, 10, 18.7, 4.6, pt(93, 97.5));
// The far arm reaches out to the side, so it looks a little longer.
const archerPushUp = pushUp(floorAnkle, 10, 18.7, 4.6, [pt(93, 97.5), pt(102, 97)]);
const diamondPushUp = pushUp(floorAnkle, 10, 18.7, 4.6, pt(95, 97.5));
const inclinePushUp = with_(pushUp(pt(26, 95), 20, 38, 27, pt(88, 79)), box(84, 81, 34));
const declinePushUp = with_(pushUp(pt(20, 61), 0, -5, -15, pt(94, 97.5)), box(4, 64, 30));

const dipBar = pt(72, 42);
const dip: ExerciseDemo = {
  poses: [
    { ...torso(pt(70, 12), pt(66, 42)), hands: dipBar, feet: pt(54, 80), toes: 40 },
    { ...torso(pt(76, 30), pt(63, 57)), hands: dipBar, feet: pt(50, 92), toes: 40 },
  ],
  props: [bar(dipBar), line(pt(80, 42), pt(80, FLOOR_Y)), line(dipBar, pt(80, 42))],
};

const pressStance = { hip: pt(60, 55), feet: [pt(70, ANKLE_Y), pt(48, ANKLE_Y)] as [Point, Point] };
const bandChestPress: ExerciseDemo = {
  poses: [
    { ...pressStance, lean: 5, hands: pt(74, 34) },
    { ...pressStance, lean: 5, hands: pt(93, 30) },
  ],
  props: [line(pt(18, -5), pt(18, FLOOR_Y)), cable(pt(18, 32))],
};

/** Lying on the back, pressing up from the chest. */
function lyingPress(shoulder: Point, ankle: Point, props: ExerciseDemo['props']): ExerciseDemo {
  const body = lyingBack(shoulder, pt(shoulder.x + 30, shoulder.y));
  return {
    poses: [
      { ...body, hands: pt(shoulder.x + 2, shoulder.y - 30), feet: ankle },
      { ...body, hands: pt(shoulder.x + 3, shoulder.y - 13), feet: ankle },
    ],
    props,
  };
}

const benchProps = [box(8, 80, 70, 8), line(pt(20, 88), pt(20, FLOOR_Y)), line(pt(68, 88), pt(68, FLOOR_Y))];

// Seated machines: seat + back rest.
const seatHip = pt(50, 70);
const seat = [box(30, 73, 32, 6), line(pt(46, 79), pt(46, FLOOR_Y)), line(pt(31, 28), pt(37, 73))];
const machineChestPress: ExerciseDemo = {
  poses: [
    { hip: seatHip, lean: -5, hands: pt(60, 41), feet: pt(78, ANKLE_Y) },
    { hip: seatHip, lean: -5, hands: pt(77, 41), feet: pt(78, ANKLE_Y) },
  ],
  props: [...seat, held('pad', 'hands')],
};

// ---------- Vertical push ----------

const standingPress = (startHands: Point, topHands: Point): ExerciseDemo => ({
  poses: [
    { hip: pt(62, 53.5), lean: 0, hands: startHands, feet: pt(62, ANKLE_Y) },
    { hip: pt(62, 53.5), lean: 0, hands: topHands, feet: pt(62, ANKLE_Y) },
  ],
});
const overheadPress = standingPress(pt(66, 18), pt(63, -6));

const machineShoulderPress: ExerciseDemo = {
  poses: [
    { hip: seatHip, lean: -5, hands: pt(52, 38), feet: pt(78, ANKLE_Y) },
    { hip: seatHip, lean: -5, hands: pt(49, 9), feet: pt(78, ANKLE_Y) },
  ],
  props: [...seat, held('pad', 'hands', { angle: 90 })],
};

const pikePushUp: ExerciseDemo = {
  poses: [
    { hip: pt(64, 54), lean: 125, hands: pt(96, 98), feet: pt(48, 96), toes: 30, head: 10 },
    { hip: pt(64, 54), lean: 147, hands: pt(96, 98), feet: pt(48, 96), toes: 30, head: 10 },
  ],
};

const elevatedPikePushUp: ExerciseDemo = {
  poses: [
    { hip: pt(64, 39), lean: 165, hands: pt(80, 97.5), feet: pt(31, 66), toes: 0 },
    { hip: pt(64, 50), lean: 165, hands: pt(80, 97.5), feet: pt(31, 66), toes: 0 },
  ],
  props: [box(14, 68, 30)],
};

const handstandPushUp: ExerciseDemo = {
  poses: [
    { hip: pt(92, 37), lean: 180, hands: pt(89, 97.5), feet: pt(100, -6), toes: 180 },
    { hip: pt(92, 54), lean: 180, hands: pt(89, 97.5), feet: pt(100, 10), toes: 180 },
  ],
  props: [line(pt(105, -20), pt(105, FLOOR_Y))],
};

// ---------- Horizontal pull ----------

const doorAnkle = pt(90, ANKLE_Y);
const towelDoorRow: ExerciseDemo = {
  poses: [
    { ...straightBody(doorAnkle, 112), hands: pt(90, 40), feet: doorAnkle },
    { ...straightBody(doorAnkle, 101), hands: pt(94, 36), feet: doorAnkle },
  ],
  props: [line(pt(110, -10), pt(110, FLOOR_Y)), cable(pt(109, 52))],
};

const strapAnchor = pt(104, -18);
const suspensionAnkle = pt(88, ANKLE_Y);
const suspensionRow: ExerciseDemo = {
  poses: [
    { ...straightBody(suspensionAnkle, 122), hands: pt(74, 22), feet: suspensionAnkle },
    { ...straightBody(suspensionAnkle, 106), hands: pt(78, 18), feet: suspensionAnkle },
  ],
  props: [cable(strapAnchor)],
};

// Under a table, gripping its edge: pull the chest up to it.
const tableAnkle = pt(125, 96);
const tableRow: ExerciseDemo = {
  poses: [
    { ...straightBody(tableAnkle, 172), hands: pt(66, 61), feet: tableAnkle, toes: 180, head: 5 },
    { ...straightBody(tableAnkle, 160), hands: pt(66, 61), feet: tableAnkle, toes: 180, head: 10 },
  ],
  props: [line(pt(4, 59), pt(70, 59)), line(pt(8, 59), pt(8, FLOOR_Y))],
};

const bandRow: ExerciseDemo = {
  poses: [
    { ...pressStance, lean: 5, hands: pt(91, 34) },
    { ...pressStance, lean: 0, hands: pt(62, 42) },
  ],
  props: [line(pt(122, -5), pt(122, FLOOR_Y)), cable(pt(122, 34))],
};

// One hand on a bench, the other rows.
const oneArmRowHip = pt(52, 56);
const oneArmRow = (kind: 'dumbbell' | 'kettlebell'): ExerciseDemo => ({
  poses: [
    {
      hip: oneArmRowHip,
      lean: 80,
      hands: [hanging(oneArmRowHip, 80), pt(90, 75)],
      feet: [pt(58, ANKLE_Y), pt(40, ANKLE_Y)],
    },
    {
      hip: oneArmRowHip,
      lean: 80,
      hands: [pt(70, 57), pt(90, 75)],
      feet: [pt(58, ANKLE_Y), pt(40, ANKLE_Y)],
    },
  ],
  props: [box(86, 77, 40), held(kind, 'hands', { oneSide: true })],
});

const seatedCableRow: ExerciseDemo = {
  poses: [
    { hip: pt(48, 77), lean: 15, hands: pt(84, 58), feet: pt(88, 74), toes: 150 },
    { hip: pt(48, 77), lean: -5, hands: pt(60, 58), feet: pt(88, 74), toes: 150 },
  ],
  props: [box(28, 80, 34), box(94, 64, 4, 18), line(pt(122, 10), pt(122, FLOOR_Y)), cable(pt(121, 58))],
};

const barbellRowHip = pt(54, 57);
const barbellRow: ExerciseDemo = {
  poses: [
    { hip: barbellRowHip, lean: 70, hands: hanging(barbellRowHip, 70), feet: pt(62, ANKLE_Y) },
    { hip: barbellRowHip, lean: 70, hands: pt(72, 60), feet: pt(62, ANKLE_Y) },
  ],
  props: [held('barbell')],
};

// ---------- Vertical pull ----------

const pullUpBar = pt(68, -14);
const pullUpFrame = [bar(pullUpBar), line(pt(72, -14), pt(110, -14)), line(pt(110, -14), pt(110, FLOOR_Y))];
const pullUp = (grip: Point, move = 1.1): ExerciseDemo => ({
  poses: [
    { ...torso(pt(63, 16), pt(62, 46)), hands: grip, feet: pt(60, 90), toes: 20 },
    { ...torso(pt(62, 4), pt(61, 34)), hands: grip, feet: pt(60, 78), toes: 20 },
  ],
  props: pullUpFrame,
  move,
});

const bandPulldown: ExerciseDemo = {
  poses: [
    { hip: pt(62, 55), lean: 0, hands: pt(67, -5), feet: pt(62, ANKLE_Y) },
    { hip: pt(62, 55), lean: 0, hands: pt(67, 20), feet: pt(62, ANKLE_Y) },
  ],
  props: [cable(pt(72, -20))],
};

const latSeatHip = pt(55, 71);
const latPulldown: ExerciseDemo = {
  poses: [
    { hip: latSeatHip, lean: -8, hands: pt(57, 12), feet: pt(80, ANKLE_Y) },
    { hip: latSeatHip, lean: -8, hands: pt(60, 36), feet: pt(80, ANKLE_Y) },
  ],
  props: [box(38, 74, 32, 6), line(pt(54, 80), pt(54, FLOOR_Y)), cable(pt(60, -20))],
};

// ---------- Core ----------

const flatShoulder = pt(35, 93);
const flatBack = lyingBack(flatShoulder, pt(65, 93));

const deadBug: ExerciseDemo = {
  poses: [
    { ...flatBack, hands: pt(37, 63), feet: pt(87, 70) },
    { ...flatBack, hands: [pt(6, 90), pt(37, 63)], feet: [pt(87, 70), pt(108, 88)] },
  ],
};

// On the forearms: elbows under the shoulders. The demo just "breathes" a little.
const plankAnkle = pt(12, 93);
const plank: ExerciseDemo = {
  poses: [
    { ...straightBody(plankAnkle, 9.2), hands: pt(101, 96), feet: plankAnkle, toes: 10 },
    { ...straightBody(plankAnkle, 10), hands: pt(101, 96), feet: plankAnkle, toes: 10 },
  ],
  move: 2,
  hold: 1,
};

// Propped on one arm, the other arm up: the hips sag, then lift into a straight line.
const sidePlankFeet = pt(14, 95);
const sidePlank: ExerciseDemo = {
  poses: [
    {
      // Shoulders a little closer to the feet, so the hips drop and the legs stay straight.
      ...torso(pt(82, 73), pt(58.8, 92)),
      hands: [pt(97, 96), pt(83, 43)],
      feet: sidePlankFeet,
      toes: 10,
    },
    { ...straightBody(sidePlankFeet, 19.5), hands: [pt(99, 96), pt(85, 40)], feet: sidePlankFeet, toes: 10 },
  ],
};

const hollowHold: ExerciseDemo = {
  poses: [
    { ...lyingBack(pt(36, 89), pt(65, 95)), hands: pt(7, 82), feet: pt(108, 86), toes: 120 },
    { ...lyingBack(pt(36, 88), pt(65, 95)), hands: pt(8, 79), feet: pt(107, 82), toes: 120 },
  ],
  move: 2,
  hold: 1,
};

const hangingKneeRaise: ExerciseDemo = {
  poses: [
    { ...torso(pt(63, 16), pt(62, 46)), hands: pullUpBar, feet: pt(60, 90), toes: 20 },
    { ...torso(pt(63, 16), pt(60, 46)), hands: pullUpBar, feet: pt(80, 62), toes: 60 },
  ],
  props: pullUpFrame,
};

const pallofPress: ExerciseDemo = {
  poses: [
    { hip: pt(62, 55), lean: 0, hands: pt(74, 34), feet: pt(62, ANKLE_Y) },
    { hip: pt(62, 55), lean: 0, hands: pt(92, 33), feet: pt(62, ANKLE_Y) },
  ],
  props: [line(pt(18, -5), pt(18, FLOOR_Y)), cable(pt(18, 34))],
};

const cableCrunch: ExerciseDemo = {
  poses: [
    { hip: pt(58, 73), lean: 15, hands: pt(70, 36), feet: pt(36, 96), toes: -90 },
    { hip: pt(54, 73), lean: 70, hands: pt(84, 61), feet: pt(36, 96), toes: -90 },
  ],
  props: [line(pt(118, -20), pt(118, FLOOR_Y)), cable(pt(117, -14))],
};

// ---------- Arms ----------

const curl = (anchor: Point | null): ExerciseDemo => ({
  poses: [
    { hip: pt(62, 53.5), lean: 0, hands: pt(63.5, 54), feet: pt(62, ANKLE_Y) },
    { hip: pt(62, 53.5), lean: 0, hands: pt(71, 28), feet: pt(62, ANKLE_Y) },
  ],
  props: anchor ? [cable(anchor)] : [],
});

const benchDip: ExerciseDemo = {
  poses: [
    { hip: pt(45, 72), lean: 0, hands: pt(40, 72), feet: pt(82, 95), toes: 160 },
    { hip: pt(47, 87), lean: 0, hands: pt(40, 72), feet: pt(82, 95), toes: 160 },
  ],
  props: [box(10, 74, 31)],
};

const pushdown = (anchor: Point): ExerciseDemo => ({
  poses: [
    { hip: pt(60, 55), lean: 10, hands: pt(73, 30), feet: pt(62, ANKLE_Y) },
    { hip: pt(60, 55), lean: 10, hands: pt(69, 55), feet: pt(62, ANKLE_Y) },
  ],
  props: [cable(anchor)],
});

const overheadExtension: ExerciseDemo = {
  poses: [
    { hip: pt(62, 53.5), lean: 0, hands: pt(63, -6), feet: pt(62, ANKLE_Y) },
    { hip: pt(62, 53.5), lean: 0, hands: pt(56, 12), feet: pt(62, ANKLE_Y) },
  ],
  props: [held('dumbbell')],
};

// Seen from the front: arms up to the sides, to shoulder height.
const lateralRaise = (props: ExerciseDemo['props']): ExerciseDemo => ({
  view: 'front',
  poses: [
    { hip: pt(70, 53.5), lean: 0, hands: [pt(59, 54), pt(81, 54)], feet: [pt(65, ANKLE_Y), pt(75, ANKLE_Y)] },
    {
      hip: pt(70, 53.5),
      lean: 0,
      hands: [pt(32, 27), pt(108, 27)],
      feet: [pt(65, ANKLE_Y), pt(75, ANKLE_Y)],
    },
  ],
  props,
});

// ---------- Calves ----------

const calfRaise = (farFoot: Point | null): ExerciseDemo => {
  const feet = (y: number): Point | [Point, Point] => (farFoot ? [pt(62, y), farFoot] : pt(62, y));
  return {
    poses: [
      {
        hip: pt(62, 53.5),
        lean: 0,
        hands: hanging(pt(62, 53.5), 0),
        feet: feet(ANKLE_Y),
        toes: farFoot ? [90, 60] : 90,
      },
      {
        hip: pt(62, 48),
        lean: 0,
        hands: hanging(pt(62, 48), 0),
        feet: feet(93),
        toes: farFoot ? [30, 60] : 30,
      },
    ],
  };
};

// ---------- Glutes ----------

const bridgeShoulder = pt(35, 93);
const gluteBridge = (farFootUp: boolean): ExerciseDemo => ({
  poses: [
    {
      ...lyingBack(bridgeShoulder, pt(65, 93)),
      hands: pt(65.5, 95),
      feet: farFootUp ? [pt(86, ANKLE_Y), pt(104, 80)] : pt(86, ANKLE_Y),
    },
    {
      ...lyingBack(bridgeShoulder, pt(63, 81)),
      hands: pt(65.5, 95),
      feet: farFootUp ? [pt(86, ANKLE_Y), pt(100, 66)] : pt(86, ANKLE_Y),
    },
  ],
});

const hipThrustShoulder = pt(32, 74);
const hipThrust = (kind: 'dumbbell' | 'barbell'): ExerciseDemo => ({
  poses: [
    { ...lyingBack(hipThrustShoulder, pt(54, 90)), hands: pt(56, 86), feet: pt(80, ANKLE_Y) },
    { ...lyingBack(hipThrustShoulder, pt(62, 74)), hands: pt(62, 72), feet: pt(80, ANKLE_Y) },
  ],
  props: [box(4, 77, 30), held(kind, 'hips')],
});

// ---------- The catalog ----------

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
  // Squat
  bodyweight_squat: squat,
  assisted_pistol_squat: assistedPistol,
  pistol_squat: pistol,
  goblet_squat: with_(goblet, held('dumbbell')),
  kettlebell_goblet_squat: with_(goblet, held('kettlebell')),
  leg_press: legPress,
  back_squat: barbellSquat(false),
  front_squat: barbellSquat(true),

  // Hinge
  single_leg_rdl: singleLegRdl,
  sliding_leg_curl: slidingLegCurl,
  nordic_curl: nordicCurl,
  band_good_morning: bandGoodMorning,
  dumbbell_rdl: with_(rdl, held('dumbbell')),
  single_leg_dumbbell_rdl: with_(singleLegRdl, held('dumbbell')),
  kettlebell_swing: kettlebellSwing,
  leg_curl_machine: legCurlMachine,
  barbell_rdl: with_(rdl, held('barbell')),
  deadlift,

  // Lunge
  reverse_lunge: reverseLunge,
  step_up: stepUp,
  split_squat: splitSquat(pt(36, 93), pt(57, 57), pt(55, 76), 'hips'),
  bulgarian_split_squat: bulgarian('hips'),
  dumbbell_walking_lunge: walkingLunge,
  dumbbell_bulgarian_split_squat: with_(bulgarian('hang'), held('dumbbell')),

  // Horizontal push
  incline_push_up: inclinePushUp,
  push_up: pushUpDemo,
  decline_push_up: declinePushUp,
  archer_push_up: archerPushUp,
  dip,
  band_chest_press: bandChestPress,
  dumbbell_floor_press: lyingPress(flatShoulder, pt(88, ANKLE_Y), [held('dumbbell')]),
  machine_chest_press: machineChestPress,
  dumbbell_bench_press: lyingPress(pt(30, 76), pt(92, ANKLE_Y), [...benchProps, held('dumbbell')]),
  barbell_bench_press: lyingPress(pt(30, 76), pt(92, ANKLE_Y), [...benchProps, held('barbell')]),

  // Vertical push
  pike_push_up: pikePushUp,
  elevated_pike_push_up: elevatedPikePushUp,
  handstand_push_up: handstandPushUp,
  band_overhead_press: with_(overheadPress, cable(pt(62, FLOOR_Y - 1))),
  dumbbell_shoulder_press: with_(overheadPress, held('dumbbell')),
  machine_shoulder_press: machineShoulderPress,
  kettlebell_press: with_(overheadPress, held('kettlebell')),
  barbell_overhead_press: with_(standingPress(pt(67, 22), pt(63, -6)), held('barbell')),

  // Horizontal pull
  towel_door_row: towelDoorRow,
  table_row: tableRow,
  suspension_row: suspensionRow,
  band_row: bandRow,
  dumbbell_row: oneArmRow('dumbbell'),
  kettlebell_row: oneArmRow('kettlebell'),
  seated_cable_row: seatedCableRow,
  barbell_row: barbellRow,

  // Vertical pull
  band_pulldown: bandPulldown,
  negative_pull_up: pullUp(pullUpBar, 2.5),
  band_assisted_pull_up: with_(pullUp(pullUpBar), cable(pullUpBar, 'feet')),
  chin_up: pullUp(pt(66, -14)),
  pull_up: pullUp(pullUpBar),
  lat_pulldown: latPulldown,

  // Core
  dead_bug: deadBug,
  plank,
  side_plank: sidePlank,
  hollow_hold: hollowHold,
  hanging_knee_raise: hangingKneeRaise,
  pallof_press: pallofPress,
  cable_crunch: cableCrunch,

  // Biceps
  band_curl: with_(curl(null), cable(pt(62, FLOOR_Y - 1))),
  dumbbell_curl: with_(curl(null), held('dumbbell')),
  hammer_curl: with_(curl(null), held('dumbbell')),
  cable_curl: with_(curl(pt(110, 92)), line(pt(112, 20), pt(112, FLOOR_Y))),
  barbell_curl: with_(curl(null), held('barbell')),

  // Triceps
  bench_dip: benchDip,
  diamond_push_up: diamondPushUp,
  band_pushdown: pushdown(pt(84, -18)),
  dumbbell_overhead_extension: overheadExtension,
  cable_pushdown: with_(pushdown(pt(84, -18)), line(pt(90, -20), pt(90, FLOOR_Y))),

  // Lateral delts
  band_lateral_raise: lateralRaise([cable(pt(70, FLOOR_Y - 1))]),
  dumbbell_lateral_raise: lateralRaise([held('dumbbell')]),
  cable_lateral_raise: lateralRaise([cable(pt(118, FLOOR_Y - 4)), line(pt(122, 0), pt(122, FLOOR_Y))]),

  // Calves
  calf_raise: calfRaise(null),
  single_leg_calf_raise: calfRaise(pt(48, 80)),
  dumbbell_calf_raise: with_(calfRaise(null), held('dumbbell')),
  machine_calf_raise: with_(calfRaise(null), held('pad', 'shoulders', { angle: 90 })),

  // Glutes
  glute_bridge: gluteBridge(false),
  single_leg_glute_bridge: gluteBridge(true),
  dumbbell_hip_thrust: hipThrust('dumbbell'),
  barbell_hip_thrust: hipThrust('barbell'),
};

/** The demo for a built-in exercise, if there is one (custom exercises have none). */
export function exerciseDemo(key: string | null | undefined): ExerciseDemo | null {
  return key ? (EXERCISE_DEMOS[key] ?? null) : null;
}
