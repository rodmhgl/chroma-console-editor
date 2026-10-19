import { describe, expect, it } from 'vitest';
import { CALIBRATION_LEVEL, PARAMS, PERFORMANCE_CONTROLS } from '../midi/map';
import { dispatch, encodeSendAll, initialEditorState, type EditorAction, type EditorState } from './core';

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

/** Each Module's Engaged/Bypassed and the CC the MIDI implementation chart gives it. */
const ENGAGED = [
  ['character', 'characterEngaged', 103],
  ['movement', 'movementEngaged', 104],
  ['diffusion', 'diffusionEngaged', 105],
  ['texture', 'textureEngaged', 106],
] as const;

/** The preset settings chosen from a short list, each choice sent as the midpoint of its range. */
const CHOICES = [
  ['filterStyle', 84, [['lowpass', 21], ['tilt', 65], ['highpass', 107]]],
  ['captureRouting', 83, [['postFx', 0], ['preFx', 127]]],
] as const;

/** Every Performance Control's actions and the CC and value the MIDI implementation chart gives each. */
const PERFORMANCE = [
  ['capture', 'record', 82, 107],
  ['capture', 'play', 82, 65],
  ['capture', 'stopClear', 82, 21],
  ['gesture', 'play', 80, 0],
  ['gesture', 'record', 80, 127],
  ['gesture', 'stopErase', 81, 127],
  ['tap', 'tap', 93, 127],
  ['pedal', 'bypass', 91, 0],
  ['pedal', 'engage', 91, 127],
  ['dualBypass', 'totalBypass', 92, 15],
  ['dualBypass', 'dualBypass', 92, 47],
  ['dualBypass', 'totalEngage', 92, 127],
  ['calibrationMenu', 'enter', 95, 127],
  ['calibrationMenu', 'exit', 95, 0],
] as const;

/** Each Calibration Level, sent as the midpoint of its quarter of CC 94. */
const CALIBRATION_LEVELS = [
  ['low', 15],
  ['medium', 47],
  ['high', 79],
  ['veryHigh', 111],
] as const;

describe('the pedal map', () => {
  it('has a byte test below for every row', () => {
    const tested = [...EFFECTS.map(([id]) => id), ...LEVELS.map(([id]) => id), ...ENGAGED.map(([, id]) => id), ...CHOICES.map(([id]) => id)];
    expect(tested.sort()).toEqual(Object.keys(PARAMS).sort());
  });

  it('has a byte test below for every Performance Control action and Calibration Level', () => {
    const actions = Object.values(PERFORMANCE_CONTROLS).flatMap((c) => c.actions.map((a) => `${c.id}.${a.id}`));
    expect(PERFORMANCE.map(([control, action]) => `${control}.${action}`).sort()).toEqual(actions.sort());
    expect(CALIBRATION_LEVELS.map(([id]) => id)).toEqual(CALIBRATION_LEVEL.choices.map((c) => c.id));
  });

  it('keeps Performance Controls and Calibration Level out of the Preset params, so Send All never sends them', () => {
    const presetCcs = new Set(Object.values(PARAMS).map((p) => p.cc));
    const ccs = [...PERFORMANCE.map(([, , cc]) => cc), CALIBRATION_LEVEL.cc];

    expect(ccs.filter((cc) => presetCcs.has(cc))).toEqual([]);
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

describe('setEngaged', () => {
  it.each(ENGAGED)('%s sends CC %i = 0 to Bypass and 127 to Engage, keeping its Effect', (module, id, cc) => {
    const before = dispatch(onMidiChannel5(), { type: 'setParam', id: `${module}Effect`, value: 76 }).state;

    const bypassed = dispatch(before, { type: 'setEngaged', module, engaged: false });
    expect(bypassed.messages).toEqual([[0xb4, cc, 0]]);
    expect(bypassed.state.working[id]).toBe(0);
    expect(bypassed.state.working[`${module}Effect`]).toBe(76);

    const engaged = dispatch(bypassed.state, { type: 'setEngaged', module, engaged: true });
    expect(engaged.messages).toEqual([[0xb4, cc, 127]]);
    expect(engaged.state.working[`${module}Effect`]).toBe(76);
  });

  it('leaves a Bypassed Module Bypassed when its Effect changes, saying so again in case the pedal engaged it', () => {
    const { state, messages } = run(
      onMidiChannel5(),
      { type: 'setEngaged', module: 'movement', engaged: false },
      { type: 'selectEffect', id: 'movementEffect', effect: 'phaser' },
    );

    expect(messages).toEqual([
      [0xb4, 104, 0],
      [0xb4, 17, 54],
      [0xb4, 104, 0],
    ]);
    expect(state.working.movementEngaged).toBe(0);
  });
});

describe('selectChoice', () => {
  it.each(CHOICES.flatMap(([id, cc, choices]) => choices.map(([choice, value]) => [id, choice, cc, value] as const)))(
    '%s %s sends CC %i = %i',
    (id, choice, cc, value) => {
      const { state, messages } = dispatch(onMidiChannel5(), { type: 'selectChoice', id, choice } as EditorAction);

      expect(messages).toEqual([[0xb4, cc, value]]);
      expect(state.working[id]).toBe(value);
    },
  );

  it('ignores a choice the setting doesn’t offer', () => {
    const { state, messages } = dispatch(onMidiChannel5(), { type: 'selectChoice', id: 'filterStyle', choice: 'preFx' } as EditorAction);

    expect(messages).toEqual([]);
    expect(state.working.filterStyle).toBe(65);
  });

  it('snaps a raw value to the choice whose range holds it', () => {
    const { messages } = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'filterStyle', value: 40 },
      { type: 'setParam', id: 'filterStyle', value: 90 },
      { type: 'setParam', id: 'textureEngaged', value: 63 },
      { type: 'setParam', id: 'textureEngaged', value: 64 },
    );

    expect(messages).toEqual([
      [0xb4, 84, 21],
      [0xb4, 84, 107],
      [0xb4, 106, 0],
      [0xb4, 106, 127],
    ]);
  });
});

/** An Editor State with some edits made, so an unchanged Working State can't pass for the default. */
const edited = () =>
  run(
    onMidiChannel5(),
    { type: 'selectEffect', id: 'diffusionEffect', effect: 'reels' },
    { type: 'setParam', id: 'diffusionAmount', value: 100 },
    { type: 'setEngaged', module: 'texture', engaged: false },
  ).state;

describe('perform', () => {
  it.each(PERFORMANCE)('%s %s sends CC %i = %i, and leaves the Editor State as it was', (control, action, cc, value) => {
    const before = edited();

    const { state, messages } = dispatch(before, { type: 'perform', control, action } as EditorAction);

    expect(messages).toEqual([[0xb4, cc, value]]);
    // The same object: no Working State change, nothing for history to record, nothing for Send All to resend.
    expect(state).toBe(before);
  });

  it('sends the same message every time, as a footswitch would', () => {
    const { messages } = run(onMidiChannel5(), { type: 'perform', control: 'tap', action: 'tap' }, { type: 'perform', control: 'tap', action: 'tap' });

    expect(messages).toEqual([
      [0xb4, 93, 127],
      [0xb4, 93, 127],
    ]);
  });

  it('ignores an action the control doesn’t offer', () => {
    const before = edited();

    const { state, messages } = dispatch(before, { type: 'perform', control: 'capture', action: 'stopErase' } as EditorAction);

    expect(messages).toEqual([]);
    expect(state).toBe(before);
  });
});

describe('setCalibrationLevel', () => {
  it.each(CALIBRATION_LEVELS)('%s sends CC 94 = %i and is held in the Global Settings, not the Working State', (level, value) => {
    const before = edited();

    const { state, messages } = dispatch(before, { type: 'setCalibrationLevel', level });

    expect(messages).toEqual([[0xb4, 94, value]]);
    expect(state.global).toEqual({ midiChannel: 5, calibrationLevel: level });
    expect(state.working).toBe(before.working);
  });

  it('ignores a level the pedal doesn’t have', () => {
    const before = edited();

    const { state, messages } = dispatch(before, { type: 'setCalibrationLevel', level: 'extreme' } as unknown as EditorAction);

    expect(messages).toEqual([]);
    expect(state).toBe(before);
  });
});

describe('the OFF range of an Effect selection', () => {
  it('is never sent, whatever value any action is given', () => {
    const state = onMidiChannel5();
    const actions: EditorAction[] = (Object.keys(PARAMS) as (keyof typeof PARAMS)[]).flatMap((id) =>
      Array.from({ length: 130 }, (_, v) => ({ type: 'setParam', id, value: v - 1 }) as const),
    );
    actions.push(...EFFECTS.flatMap(([id, , effects]) => effects.map((effect) => ({ type: 'selectEffect', id, effect }) as EditorAction)));
    actions.push(...ENGAGED.flatMap(([module]) => [true, false].map((engaged) => ({ type: 'setEngaged', module, engaged }) as const)));
    actions.push(...CHOICES.flatMap(([id, , choices]) => choices.map(([choice]) => ({ type: 'selectChoice', id, choice }) as EditorAction)));

    // From a fresh state and from one with every Module Bypassed, which re-sends Bypassed after an Effect change.
    const bypassed = run(state, ...ENGAGED.map(([module]) => ({ type: 'setEngaged', module, engaged: false }) as const)).state;
    const sent = [state, bypassed].flatMap((from) => actions.flatMap((action) => dispatch(from, action).messages));
    const effectSelections = sent.filter(([, cc]) => cc! >= 16 && cc! <= 19);

    expect(effectSelections.length).toBeGreaterThan(0);
    expect(effectSelections.filter(([, , value]) => value! >= 110)).toEqual([]);
  });
});

describe('the initial Editor State', () => {
  it('sends on MIDI channel 1 from the manual’s baseline: first Effects, all Engaged, Mix 100%, Tilt and Secondary Controls neutral, no Drift, Filter style Tilt, Capture post-FX', () => {
    const state = initialEditorState();

    // The editor can't read the pedal's Calibration Level, so it is unknown until set from the editor.
    expect(state.global).toEqual({ midiChannel: 1, calibrationLevel: null });
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
      characterEngaged: 127,
      movementEngaged: 127,
      diffusionEngaged: 127,
      textureEngaged: 127,
      filterStyle: 65,
      captureRouting: 0,
    });
  });
});

describe('undo/redo', () => {
  it('steps back one edit at a time and forward again, re-sending each restored value', () => {
    const edited = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'tilt', value: 30 },
      { type: 'selectEffect', id: 'diffusionEffect', effect: 'reels' },
      { type: 'setEngaged', module: 'texture', engaged: false },
      { type: 'selectChoice', id: 'filterStyle', choice: 'highpass' },
    ).state;

    const undone = run(edited, { type: 'undo' }, { type: 'undo' }, { type: 'undo' }, { type: 'undo' });
    expect(undone.messages).toEqual([
      [0xb4, 84, 65],
      [0xb4, 106, 127],
      [0xb4, 18, 10],
      [0xb4, 64, 64],
    ]);
    expect(undone.state.working).toEqual(initialEditorState().working);

    const redone = run(undone.state, { type: 'redo' }, { type: 'redo' });
    expect(redone.messages).toEqual([
      [0xb4, 64, 30],
      [0xb4, 18, 32],
    ]);
    expect(redone.state.working).toMatchObject({ tilt: 30, diffusionEffect: 32, textureEngaged: 127 });
  });

  it('records a drag as one step', () => {
    const { state } = run(
      onMidiChannel5(),
      { type: 'beginDrag' },
      ...[70, 80, 90].map((value) => ({ type: 'setParam', id: 'mix', value }) as const),
      { type: 'endDrag' },
    );

    const undone = dispatch(state, { type: 'undo' });
    expect(undone.messages).toEqual([[0xb4, 70, 127]]);
    expect(dispatch(undone.state, { type: 'undo' }).messages).toEqual([]);
    expect(dispatch(undone.state, { type: 'redo' }).messages).toEqual([[0xb4, 70, 90]]);
  });

  it('says Bypassed again when it changes a Bypassed Module’s Effect', () => {
    const { state } = run(
      onMidiChannel5(),
      { type: 'setEngaged', module: 'movement', engaged: false },
      { type: 'selectEffect', id: 'movementEffect', effect: 'phaser' },
    );

    const undone = dispatch(state, { type: 'undo' });
    expect(undone.messages).toEqual([
      [0xb4, 17, 10],
      [0xb4, 104, 0],
    ]);
    expect(dispatch(undone.state, { type: 'redo' }).messages).toEqual([
      [0xb4, 17, 54],
      [0xb4, 104, 0],
    ]);
  });

  it('records nothing for the MIDI channel or an edit that changes nothing', () => {
    const { state } = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'tilt', value: 64 },
      { type: 'selectEffect', id: 'characterEffect', effect: 'drive' },
      { type: 'selectEffect', id: 'characterEffect', effect: 'pitch' } as EditorAction,
      { type: 'setMidiChannel', midiChannel: 9 },
    );

    expect(dispatch(state, { type: 'undo' })).toEqual({ state, messages: [] });
    expect(state.global.midiChannel).toBe(9);
  });

  it('never records a Performance Control or the Calibration Level, nor lets one clear the redo steps', () => {
    const others: EditorAction[] = [
      ...PERFORMANCE.map(([control, action]) => ({ type: 'perform', control, action }) as EditorAction),
      ...CALIBRATION_LEVELS.map(([level]) => ({ type: 'setCalibrationLevel', level }) as const),
    ];
    const { state } = run(
      onMidiChannel5(),
      { type: 'setParam', id: 'tilt', value: 30 },
      { type: 'setParam', id: 'rate', value: 90 },
      { type: 'undo' },
      ...others,
    );

    const undone = dispatch(state, { type: 'undo' });
    expect(undone.messages).toEqual([[0xb4, 64, 64]]);
    expect(dispatch(undone.state, { type: 'undo' }).messages).toEqual([]);
    expect(run(undone.state, { type: 'redo' }, { type: 'redo' }).messages).toEqual([
      [0xb4, 64, 30],
      [0xb4, 66, 90],
    ]);
    expect(undone.state.global.calibrationLevel).toBe('veryHigh');
  });

  it('re-sends on the MIDI channel the editor sends on now', () => {
    const { state } = run(onMidiChannel5(), { type: 'setParam', id: 'time', value: 0 }, { type: 'setMidiChannel', midiChannel: 2 });

    expect(dispatch(state, { type: 'undo' }).messages).toEqual([[0xb1, 68, 64]]);
  });

  it('does nothing with nothing to undo or redo', () => {
    const state = onMidiChannel5();
    expect(dispatch(state, { type: 'undo' })).toEqual({ state, messages: [] });
    expect(dispatch(state, { type: 'redo' })).toEqual({ state, messages: [] });
  });
});

describe('Send All', () => {
  it('sends every Working State setting: Effects, then Filter style and Capture Routing, Primary Controls, Secondary Controls, and Engaged/Bypassed last', () => {
    const state = run(
      onMidiChannel5(),
      { type: 'selectEffect', id: 'characterEffect', effect: 'howl' },
      { type: 'selectEffect', id: 'textureEffect', effect: 'broken' },
      { type: 'selectChoice', id: 'filterStyle', choice: 'highpass' },
      { type: 'selectChoice', id: 'captureRouting', choice: 'preFx' },
      { type: 'setParam', id: 'tilt', value: 10 },
      { type: 'setParam', id: 'diffusionDrift', value: 90 },
      { type: 'setEngaged', module: 'movement', engaged: false },
    ).state;

    expect(encodeSendAll(state)).toEqual([
      [0xb4, 16, 76],
      [0xb4, 17, 10],
      [0xb4, 18, 10],
      [0xb4, 19, 76],
      [0xb4, 84, 107],
      [0xb4, 83, 127],
      [0xb4, 64, 10],
      [0xb4, 65, 64],
      [0xb4, 66, 64],
      [0xb4, 67, 64],
      [0xb4, 68, 64],
      [0xb4, 69, 64],
      [0xb4, 70, 127],
      [0xb4, 71, 64],
      [0xb4, 72, 64],
      [0xb4, 73, 64],
      [0xb4, 74, 0],
      [0xb4, 75, 64],
      [0xb4, 76, 90],
      [0xb4, 77, 64],
      [0xb4, 78, 64],
      [0xb4, 79, 64],
      [0xb4, 103, 127],
      [0xb4, 104, 0],
      [0xb4, 105, 127],
      [0xb4, 106, 127],
    ]);
  });
});

describe('Sync Status', () => {
  const inSync = () => run(onMidiChannel5(), { type: 'outputConnected' }, { type: 'sendAllFinished' }).state;

  it('is Unknown with no output, and Possibly Stale once one connects', () => {
    const state = onMidiChannel5();
    expect(state.sync).toBe('unknown');

    const connected = dispatch(state, { type: 'outputConnected' });
    expect(connected.state.sync).toBe('possiblyStale');
    expect(connected.messages).toEqual([]);
  });

  it('is In Sync after Send All, and maintained by live sends', () => {
    const state = run(
      inSync(),
      { type: 'setParam', id: 'tilt', value: 3 },
      { type: 'selectEffect', id: 'movementEffect', effect: 'pitch' },
      { type: 'setEngaged', module: 'texture', engaged: false },
      { type: 'selectChoice', id: 'filterStyle', choice: 'lowpass' },
    ).state;

    expect(state.sync).toBe('inSync');
  });

  it('never earns trust from a live send it didn’t already have', () => {
    for (const start of [onMidiChannel5(), dispatch(onMidiChannel5(), { type: 'outputConnected' }).state]) {
      expect(dispatch(start, { type: 'setParam', id: 'tilt', value: 3 }).state.sync).toBe(start.sync);
    }
  });

  it('is Possibly Stale on reconnecting, and Unknown when the output is lost', () => {
    expect(dispatch(inSync(), { type: 'outputConnected' }).state.sync).toBe('possiblyStale');
    expect(dispatch(inSync(), { type: 'outputLost' }).state.sync).toBe('unknown');
  });

  it('is Possibly Stale after a failed send or a Raw MIDI message, but stays Unknown if it was', () => {
    expect(dispatch(inSync(), { type: 'sendFailed' }).state.sync).toBe('possiblyStale');
    expect(dispatch(inSync(), { type: 'rawSent' }).state.sync).toBe('possiblyStale');
    expect(dispatch(onMidiChannel5(), { type: 'sendFailed' }).state.sync).toBe('unknown');
    expect(dispatch(onMidiChannel5(), { type: 'rawSent' }).state.sync).toBe('unknown');
  });

  it('is Possibly Stale after the MIDI channel changes, since live sends may no longer reach the pedal', () => {
    expect(dispatch(inSync(), { type: 'setMidiChannel', midiChannel: 6 }).state.sync).toBe('possiblyStale');
    expect(dispatch(inSync(), { type: 'setMidiChannel', midiChannel: 5 }).state.sync).toBe('inSync');
  });
});
