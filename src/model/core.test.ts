import { describe, expect, it } from 'vitest';
import { PARAMS } from '../midi/map';
import { dispatch, initialEditorState, type EditorAction, type EditorState } from './core';

/** Dispatches each action in turn; the messages are every action's, in order. */
function run(state: EditorState, ...actions: EditorAction[]) {
  return actions.reduce(
    (acc, action) => {
      const result = dispatch(acc.state, action);
      return { state: result.state, messages: [...acc.messages, ...result.messages] };
    },
    { state, messages: [] as number[][] },
  );
}

/** A fresh Editor State sending on MIDI channel 5, so a channel bug can't hide behind the default. */
const onMidiChannel5 = () => dispatch(initialEditorState(), { type: 'setMidiChannel', midiChannel: 5 }).state;

/** Every Effect each Module offers, in the order the MIDI implementation chart gives their CC ranges. */
const EFFECTS = [
  ['characterEffect', 16, ['drive', 'sweeten', 'fuzz', 'howl', 'swell']],
  ['movementEffect', 17, ['doubler', 'vibrato', 'phaser', 'tremolo', 'pitch']],
  ['diffusionEffect', 18, ['cascade', 'reels', 'space', 'collage', 'reverse']],
  ['textureEffect', 19, ['filter', 'squash', 'cassette', 'broken', 'interference']],
] as const;

/** The midpoints of the five Effect ranges, 0–21, 22–43, 44–65, 66–87 and 88–109. */
const MIDPOINTS = [10, 32, 54, 76, 98];

/** Every Primary and Secondary Control and the CC the MIDI implementation chart gives it. */
const LEVELS = [
  ['tilt', 64],
  ['characterAmount', 65],
  ['rate', 66],
  ['movementAmount', 67],
  ['time', 68],
  ['diffusionAmount', 69],
  ['mix', 70],
  ['textureAmount', 71],
  ['sensitivity', 72],
  ['characterEffectVol', 73],
  ['movementDrift', 74],
  ['movementEffectVol', 75],
  ['diffusionDrift', 76],
  ['diffusionEffectVol', 77],
  ['outputLevel', 78],
  ['textureEffectVol', 79],
] as const;

describe('the pedal map', () => {
  it('has a byte test below for every row', () => {
    const tested = [...EFFECTS.map(([id]) => id), ...LEVELS.map(([id]) => id)];
    expect(tested.sort()).toEqual(Object.keys(PARAMS).sort());
  });
});

describe('selectEffect', () => {
  it.each(EFFECTS.flatMap(([id, cc, effects]) => effects.map((effect, i) => [id, effect, cc, MIDPOINTS[i]] as const)))(
    '%s %s sends CC %i = %i, the midpoint of its range',
    (id, effect, cc, value) => {
      const { state, messages } = dispatch(onMidiChannel5(), { type: 'selectEffect', id, effect } as EditorAction);

      expect(messages).toEqual([[0xb4, cc, value]]);
      expect(state.working[id]).toBe(value);
    },
  );

  it('ignores an Effect another Module hosts', () => {
    const { state, messages } = dispatch(onMidiChannel5(), { type: 'selectEffect', id: 'characterEffect', effect: 'pitch' } as EditorAction);

    expect(messages).toEqual([]);
    expect(state.working.characterEffect).toBe(10);
  });
});

describe('setParam', () => {
  it.each(LEVELS)('%s sends CC %i as-is and lands in the Working State', (id, cc) => {
    const { state, messages } = run(onMidiChannel5(), { type: 'setParam', id, value: 0 }, { type: 'setParam', id, value: 100 });

    expect(messages).toEqual([
      [0xb4, cc, 0],
      [0xb4, cc, 100],
    ]);
    expect(state.working[id]).toBe(100);
  });

  it('clamps and rounds values into 0–127', () => {
    const { messages } = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'characterAmount', value: 200 },
      { type: 'setParam', id: 'characterAmount', value: -5 },
      { type: 'setParam', id: 'tilt', value: 63.6 },
    );

    expect(messages).toEqual([
      [0xb4, 65, 127],
      [0xb4, 65, 0],
      [0xb4, 64, 64],
    ]);
  });

  it.each(EFFECTS.map(([id, cc]) => [id, cc] as const))(
    'snaps %s (CC %i) to its Effect’s midpoint, and never into OFF (110–127)',
    (id, cc) => {
      const { messages } = run(onMidiChannel5(), { type: 'setParam', id, value: 70 }, { type: 'setParam', id, value: 120 });

      expect(messages).toEqual([
        [0xb4, cc, 76],
        [0xb4, cc, 98],
      ]);
    },
  );
});

describe('the initial Editor State', () => {
  it('sends on MIDI channel 1 from the manual’s baseline: first Effects, Mix 100%, Tilt and Secondary Controls neutral, no Drift', () => {
    const state = initialEditorState();

    expect(state.global).toEqual({ midiChannel: 1 });
    expect(state.working).toEqual({
      characterEffect: 10,
      movementEffect: 10,
      diffusionEffect: 10,
      textureEffect: 10,
      tilt: 64,
      rate: 64,
      time: 64,
      mix: 127,
      characterAmount: 64,
      movementAmount: 64,
      diffusionAmount: 64,
      textureAmount: 64,
      sensitivity: 64,
      outputLevel: 64,
      movementDrift: 0,
      diffusionDrift: 0,
      characterEffectVol: 64,
      movementEffectVol: 64,
      diffusionEffectVol: 64,
      textureEffectVol: 64,
    });
  });
});
