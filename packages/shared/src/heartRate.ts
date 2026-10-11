/**
 * Heart rate during a workout, measured by a watch and read back from Apple
 * Health or Health Connect (docs/decisoes.md §51). The app never measures it
 * itself: it only summarises what the watch recorded.
 */

export type HeartRateSample = { time: string; bpm: number };
export type HeartRateSummary = { avg: number; max: number; samples: number };

/** Readings outside this range are sensor glitches, not heartbeats. */
const MIN_BPM = 30;
const MAX_BPM = 230;
/** Fewer readings than this don't describe a workout. */
const MIN_SAMPLES = 3;

/**
 * Average and maximum heart rate between `start` and `end` (ISO dates).
 * Null when the watch recorded too little (not worn, or no watch at all).
 */
export function summarizeHeartRate(
  samples: readonly HeartRateSample[],
  start: string,
  end: string
): HeartRateSummary | null {
  const from = Date.parse(start);
  const to = Date.parse(end);
  const valid = samples.filter((sample) => {
    const time = Date.parse(sample.time);
    return time >= from && time <= to && sample.bpm >= MIN_BPM && sample.bpm <= MAX_BPM;
  });
  if (valid.length < MIN_SAMPLES) return null;
  const total = valid.reduce((sum, sample) => sum + sample.bpm, 0);
  return {
    avg: Math.round(total / valid.length),
    max: Math.round(Math.max(...valid.map((sample) => sample.bpm))),
    samples: valid.length,
  };
}
