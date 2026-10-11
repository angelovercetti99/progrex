import { describe, expect, it } from 'vitest';

import { summarizeHeartRate } from './heartRate';

const START = '2026-10-11T10:00:00.000Z';
const END = '2026-10-11T11:00:00.000Z';
const at = (minute: number, bpm: number) => ({
  time: new Date(Date.parse(START) + minute * 60_000).toISOString(),
  bpm,
});

describe('summarizeHeartRate', () => {
  it('average and maximum during the workout', () => {
    expect(summarizeHeartRate([at(1, 100), at(10, 140), at(20, 120)], START, END)).toEqual({
      avg: 120,
      max: 140,
      samples: 3,
    });
  });

  it('ignores readings before or after the workout', () => {
    const summary = summarizeHeartRate(
      [at(-5, 180), at(1, 90), at(2, 100), at(3, 110), at(70, 190)],
      START,
      END
    );
    expect(summary?.max).toBe(110);
  });

  it('ignores sensor glitches', () => {
    const summary = summarizeHeartRate(
      [at(1, 0), at(2, 100), at(3, 110), at(4, 120), at(5, 260)],
      START,
      END
    );
    expect(summary).toEqual({ avg: 110, max: 120, samples: 3 });
  });

  it('nothing to show when the watch recorded too little', () => {
    expect(summarizeHeartRate([], START, END)).toBeNull();
    expect(summarizeHeartRate([at(1, 100), at(2, 100)], START, END)).toBeNull();
  });
});
