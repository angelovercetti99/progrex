import { describe, expect, it } from 'vitest';

import {
  acceptsCommand,
  decodeWatchCommand,
  encodeWatchState,
  WATCH_COMMAND_KEY,
  WatchStateSchema,
  type WatchState,
} from './watch';

const state: WatchState = {
  v: 1,
  workoutId: 'w1',
  itemId: 'we1',
  setNumber: 2,
  title: 'Goblet squat',
  subtitle: 'Set 2 of 3',
  target: '20 kg × 10',
  action: 'Complete set',
  restLabel: 'Rest',
  restSince: null,
  restSeconds: 90,
  done: false,
  doneLabel: 'All done',
};

describe('watch protocol', () => {
  it('state travels as a JSON string (no nulls in the payload)', () => {
    const payload = encodeWatchState(state);
    expect(Object.values(payload).every((value) => typeof value === 'string')).toBe(true);
    expect(WatchStateSchema.parse(JSON.parse(payload.state))).toEqual(state);
    expect(encodeWatchState(null)).toEqual({ state: '' });
  });

  it('reads a command from the watch, and ignores anything else', () => {
    const command = { v: 1, type: 'complete_set', workoutId: 'w1', itemId: 'we1', setNumber: 2 };
    expect(decodeWatchCommand({ [WATCH_COMMAND_KEY]: JSON.stringify(command) })).toEqual(command);
    expect(decodeWatchCommand({ [WATCH_COMMAND_KEY]: '{not json' })).toBeNull();
    expect(decodeWatchCommand({ [WATCH_COMMAND_KEY]: JSON.stringify({ ...command, v: 2 }) })).toBeNull();
    expect(decodeWatchCommand({ other: 1 })).toBeNull();
  });

  it('a tap that arrives twice logs the set once', () => {
    const command = {
      v: 1 as const,
      type: 'complete_set' as const,
      workoutId: 'w1',
      itemId: 'we1',
      setNumber: 2,
    };
    expect(acceptsCommand(command, 'w1', 1)).toBe(true);
    expect(acceptsCommand(command, 'w1', 2)).toBe(false);
    expect(acceptsCommand(command, 'w2', 1)).toBe(false);
  });
});
