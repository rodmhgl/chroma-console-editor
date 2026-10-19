import { describe, expect, it } from 'vitest';
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

describe('selectEffect', () => {
  it.each([
    ['drive', 10],
    ['sweeten', 32],
    ['fuzz', 54],
    ['howl', 76],
    ['swell', 98],
  ] as const)('choosing %s in Character sends CC 16 = %i, the midpoint of its range', (effect, value) => {
    const { state, messages } = dispatch(onMidiChannel5(), { type: 'selectEffect', id: 'characterEffect', effect });

    expect(messages).toEqual([[0xb4, 16, value]]);
    expect(state.working.characterEffect).toBe(value);
  });
});

describe('setParam', () => {
  it.each([
    ['characterAmount', 65, 100],
    ['tilt', 64, 20],
  ] as const)('%s sends CC %i = %i and lands in the Working State', (id, cc, value) => {
    const { state, messages } = dispatch(onMidiChannel5(), { type: 'setParam', id, value });

    expect(messages).toEqual([[0xb4, cc, value]]);
    expect(state.working[id]).toBe(value);
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

  it('snaps an Effect selection to its Effect’s midpoint, and never into OFF (110–127)', () => {
    const { messages } = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'characterEffect', value: 70 },
      { type: 'setParam', id: 'characterEffect', value: 120 },
    );

    expect(messages).toEqual([
      [0xb4, 16, 76],
      [0xb4, 16, 98],
    ]);
  });
});

describe('the initial Editor State', () => {
  it('sends on MIDI channel 1, with Drive selected, Amount at noon and Tilt neutral', () => {
    const state = initialEditorState();

    expect(state.global).toEqual({ midiChannel: 1 });
    expect(state.working).toEqual({ characterEffect: 10, characterAmount: 64, tilt: 64 });
  });
});
