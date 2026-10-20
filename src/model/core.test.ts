import { describe, expect, it } from 'vitest';
import { CALIBRATION_LEVEL, PARAMS, PERFORMANCE_CONTROLS, moduleOrderOf, type ParamDef } from '../midi/map';
import {
  dispatch,
  encodeSendAll,
  inexactPedalSteps,
  initialEditorState,
  shownState,
  syncStatus,
  unconfirmedPedalSteps,
  type EditorAction,
  type EditorState,
} from './core';

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

/** The settings MIDI can't reach, each covered by a no-bytes test of its own below. */
const PEDAL_STEPS = ['moduleOrder'] as const;

describe('the pedal map', () => {
  it('has a byte test below for every row, or a no-bytes test for a Pedal Step setting', () => {
    const tested = [...EFFECTS.map(([id]) => id), ...LEVELS.map(([id]) => id), ...ENGAGED.map(([, id]) => id), ...CHOICES.map(([id]) => id), ...PEDAL_STEPS];
    expect(tested.sort()).toEqual(Object.keys(PARAMS).sort());
  });

  it('has a byte test below for every Performance Control action and Calibration Level', () => {
    const actions = Object.values(PERFORMANCE_CONTROLS).flatMap((c) => c.actions.map((a) => `${c.id}.${a.id}`));
    expect(PERFORMANCE.map(([control, action]) => `${control}.${action}`).sort()).toEqual(actions.sort());
    expect(CALIBRATION_LEVELS.map(([id]) => id)).toEqual(CALIBRATION_LEVEL.choices.map((c) => c.id));
  });

  it('keeps Performance Controls and Calibration Level out of the Preset params, so Send All never sends them', () => {
    const presetCcs = new Set((Object.values(PARAMS) as ParamDef[]).map((p) => p.cc));
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
      moduleOrder: 0,
    });
    expect(unconfirmedPedalSteps(state)).toEqual([]);
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
    expect(syncStatus(state)).toBe('unknown');

    const connected = dispatch(state, { type: 'outputConnected' });
    expect(syncStatus(connected.state)).toBe('possiblyStale');
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

    expect(syncStatus(state)).toBe('inSync');
  });

  it('never earns trust from a live send it didn’t already have', () => {
    for (const start of [onMidiChannel5(), dispatch(onMidiChannel5(), { type: 'outputConnected' }).state]) {
      expect(syncStatus(dispatch(start, { type: 'setParam', id: 'tilt', value: 3 }).state)).toBe(syncStatus(start));
    }
  });

  it('is Possibly Stale on reconnecting, and Unknown when the output is lost', () => {
    expect(syncStatus(dispatch(inSync(), { type: 'outputConnected' }).state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(inSync(), { type: 'outputLost' }).state)).toBe('unknown');
  });

  it('is Possibly Stale after a failed send or a Raw MIDI message, but stays Unknown if it was', () => {
    expect(syncStatus(dispatch(inSync(), { type: 'sendFailed' }).state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(inSync(), { type: 'rawSent' }).state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(onMidiChannel5(), { type: 'sendFailed' }).state)).toBe('unknown');
    expect(syncStatus(dispatch(onMidiChannel5(), { type: 'rawSent' }).state)).toBe('unknown');
  });

  it('is Possibly Stale after the MIDI channel changes, since live sends may no longer reach the pedal', () => {
    expect(syncStatus(dispatch(inSync(), { type: 'setMidiChannel', midiChannel: 6 }).state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(inSync(), { type: 'setMidiChannel', midiChannel: 5 }).state)).toBe('inSync');
  });
});

describe('Module Order, a Pedal Step setting', () => {
  const inSync = () => run(onMidiChannel5(), { type: 'outputConnected' }, { type: 'sendAllFinished' }).state;
  const reversed = ['texture', 'diffusion', 'movement', 'character'] as const;

  it('starts at Character → Movement → Diffusion → Texture, permutation 0', () => {
    const state = initialEditorState();

    expect(state.working.moduleOrder).toBe(0);
    expect(moduleOrderOf(state.working)).toEqual(['character', 'movement', 'diffusion', 'texture']);
  });

  it('is stored as one of the 24 permutation indexes, each a different order', () => {
    const orders = new Set<string>();
    for (let index = 0; index < 24; index++) {
      const { state } = dispatch(initialEditorState(), { type: 'setParam', id: 'moduleOrder', value: index });
      expect(state.working.moduleOrder).toBe(index);
      orders.add(moduleOrderOf(state.working).join());
    }

    expect(orders.size).toBe(24);
    expect(dispatch(initialEditorState(), { type: 'setModuleOrder', order: [...reversed] }).state.working.moduleOrder).toBe(23);
    expect(dispatch(initialEditorState(), { type: 'setParam', id: 'moduleOrder', value: 99 }).state.working.moduleOrder).toBe(23);
  });

  it('sends no MIDI, and makes the Sync Status Possibly Stale until its Pedal Step is confirmed', () => {
    const { state, messages } = dispatch(inSync(), { type: 'setModuleOrder', order: [...reversed] });

    expect(messages).toEqual([]);
    expect(moduleOrderOf(state.working)).toEqual(reversed);
    expect(syncStatus(state)).toBe('possiblyStale');
    expect(unconfirmedPedalSteps(state)).toEqual(['moduleOrder']);

    const confirmed = dispatch(state, { type: 'confirmPedalStep', id: 'moduleOrder' });
    expect(confirmed.messages).toEqual([]);
    expect(syncStatus(confirmed.state)).toBe('inSync');
    expect(unconfirmedPedalSteps(confirmed.state)).toEqual([]);
  });

  it('earns no trust in the MIDI-reachable settings when confirmed', () => {
    const connected = dispatch(onMidiChannel5(), { type: 'outputConnected' }).state;
    const state = run(connected, { type: 'setModuleOrder', order: [...reversed] }, { type: 'confirmPedalStep', id: 'moduleOrder' }).state;

    expect(syncStatus(state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(onMidiChannel5(), { type: 'setModuleOrder', order: [...reversed] }).state)).toBe('unknown');
  });

  it('is never sent by Send All, which can’t make the Sync Status In Sync until the Pedal Step is confirmed', () => {
    const connected = dispatch(onMidiChannel5(), { type: 'outputConnected' }).state;
    const sent = run(connected, { type: 'setModuleOrder', order: [...reversed] }, { type: 'sendAllFinished' }).state;

    expect(encodeSendAll(sent)).toEqual(encodeSendAll(onMidiChannel5()));
    expect(syncStatus(sent)).toBe('possiblyStale');
    expect(syncStatus(dispatch(sent, { type: 'confirmPedalStep', id: 'moduleOrder' }).state)).toBe('inSync');
  });

  it('undoes and redoes without sending anything; undoing back to the confirmed order needs no Pedal Step', () => {
    const changed = dispatch(inSync(), { type: 'setModuleOrder', order: [...reversed] }).state;

    const undone = dispatch(changed, { type: 'undo' });
    expect(undone.messages).toEqual([]);
    expect(undone.state.working.moduleOrder).toBe(0);
    expect(syncStatus(undone.state)).toBe('inSync');

    const redone = dispatch(undone.state, { type: 'redo' });
    expect(redone.messages).toEqual([]);
    expect(syncStatus(redone.state)).toBe('possiblyStale');

    const confirmed = dispatch(changed, { type: 'confirmPedalStep', id: 'moduleOrder' }).state;
    const undoneAfterConfirming = dispatch(confirmed, { type: 'undo' }).state;
    expect(unconfirmedPedalSteps(undoneAfterConfirming)).toEqual(['moduleOrder']);
    expect(syncStatus(undoneAfterConfirming)).toBe('possiblyStale');
  });

  it('records no undo step for an order already set, nor for confirming', () => {
    const changed = dispatch(initialEditorState(), { type: 'setModuleOrder', order: [...reversed] }).state;
    const state = run(
      changed,
      { type: 'setModuleOrder', order: [...reversed] },
      { type: 'confirmPedalStep', id: 'moduleOrder' },
      { type: 'undo' },
    ).state;

    // The one undo step is the change itself.
    expect(state.working.moduleOrder).toBe(0);
    expect(dispatch(state, { type: 'undo' }).state).toBe(state);
  });

  it('ignores an order that isn’t the four Modules once each', () => {
    const start = initialEditorState();
    for (const order of [['character', 'movement', 'diffusion'], ['character', 'character', 'diffusion', 'texture']] as const) {
      expect(dispatch(start, { type: 'setModuleOrder', order: [...order] }).state).toBe(start);
    }
  });
});

describe('loadWorking', () => {
  const working = {
    ...initialEditorState().working,
    characterEffect: 76,
    tilt: 20,
    diffusionEngaged: 0,
    filterStyle: 107,
  };
  const inSync = () => run(onMidiChannel5(), { type: 'outputConnected' }, { type: 'sendAllFinished' }).state;

  it('makes it the Working State and sends nothing: the store follows it with Send All', () => {
    const { state, messages } = dispatch(inSync(), { type: 'loadWorking', working });

    expect(state.working).toEqual(working);
    expect(messages).toEqual([]);
  });

  it('is Possibly Stale until Send All finishes, and stays Unknown with no output', () => {
    const loaded = dispatch(inSync(), { type: 'loadWorking', working }).state;
    expect(syncStatus(loaded)).toBe('possiblyStale');
    expect(syncStatus(dispatch(loaded, { type: 'sendAllFinished' }).state)).toBe('inSync');

    expect(syncStatus(dispatch(onMidiChannel5(), { type: 'loadWorking', working }).state)).toBe('unknown');
  });

  it('clamps what it is given, so an Effect selection never lands in OFF', () => {
    const { state } = dispatch(onMidiChannel5(), {
      type: 'loadWorking',
      working: { ...working, characterEffect: 120, mix: 400 },
    });

    expect(state.working).toMatchObject({ characterEffect: 98, mix: 127 });
  });

  it('clears the undo history, whose steps belong to the old Working State', () => {
    const edited = dispatch(onMidiChannel5(), { type: 'setParam', id: 'tilt', value: 30 }).state;
    const loaded = dispatch(edited, { type: 'loadWorking', working }).state;

    expect(dispatch(loaded, { type: 'undo' })).toEqual({ state: loaded, messages: [] });
  });
});

describe('recallSlot', () => {
  const committed = { ...initialEditorState().working, characterEffect: 76, tilt: 20, movementEngaged: 0 };
  /** In Sync on MIDI channel 5, with an edit to undo and Slot B-14 (PC 33) in the Slot Map. */
  const withSlotMap = (): EditorState => {
    const state = run(
      onMidiChannel5(),
      { type: 'outputConnected' },
      { type: 'sendAllFinished' },
      { type: 'setParam', id: 'mix', value: 3 },
    ).state;
    return { ...state, slotMap: { 33: { committed, presetId: 'shimmer', name: 'Shimmer Tape' } } };
  };

  it('starts with an empty Slot Map', () => {
    expect(initialEditorState().slotMap).toEqual({});
  });

  it('sends the Program Change for the Slot: PC 0–79 is A-1 … D-20', () => {
    for (const slot of [0, 33, 79]) {
      expect(dispatch(withSlotMap(), { type: 'recallSlot', slot }).messages).toEqual([[0xc4, slot]]);
    }
  });

  it('ignores a Program Change past the 80 Slots', () => {
    const state = withSlotMap();
    expect(dispatch(state, { type: 'recallSlot', slot: 80 })).toEqual({ state, messages: [] });
    expect(dispatch(state, { type: 'recallSlot', slot: -1 })).toEqual({ state, messages: [] });
  });

  it('makes a known Slot’s committed state the Working State, Possibly Stale: the pedal never confirmed the Slot Map', () => {
    const { state } = dispatch(withSlotMap(), { type: 'recallSlot', slot: 33 });

    expect(state.working).toEqual(committed);
    expect(syncStatus(state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(state, { type: 'sendAllFinished' }).state)).toBe('inSync');
  });

  it('is Possibly Stale after a known Slot even from Unknown, since the Slot replaces whatever the pedal was sounding', () => {
    const unknown = dispatch(withSlotMap(), { type: 'recallSlot', slot: 0 }).state;
    expect(syncStatus(dispatch(unknown, { type: 'recallSlot', slot: 33 }).state)).toBe('possiblyStale');
  });

  it('leaves the Working State alone on an unknown Slot, but makes the Sync Status Unknown', () => {
    const before = withSlotMap();
    const { state } = dispatch(before, { type: 'recallSlot', slot: 0 });

    expect(state.working).toEqual(before.working);
    expect(syncStatus(state)).toBe('unknown');
  });

  it('clears the undo history either way: undoing would send one CC into what the Slot holds', () => {
    for (const slot of [0, 33]) {
      const recalled = dispatch(withSlotMap(), { type: 'recallSlot', slot }).state;
      expect(dispatch(recalled, { type: 'undo' })).toEqual({ state: recalled, messages: [] });
    }
  });

  it('takes a known Slot’s Module Order as already on the pedal, since the Slot holds it; an unknown Slot changes nothing', () => {
    const reordered = { ...committed, moduleOrder: 23 };
    const before = { ...withSlotMap(), slotMap: { 33: { committed: reordered, presetId: 'shimmer', name: 'Shimmer Tape' } } };

    const known = dispatch(before, { type: 'recallSlot', slot: 33 }).state;
    expect(unconfirmedPedalSteps(known)).toEqual([]);
    expect(syncStatus(dispatch(known, { type: 'sendAllFinished' }).state)).toBe('inSync');

    const changed = dispatch(before, { type: 'setModuleOrder', order: ['texture', 'diffusion', 'movement', 'character'] }).state;
    const unknown = dispatch(changed, { type: 'recallSlot', slot: 0 }).state;
    expect(unconfirmedPedalSteps(unknown)).toEqual(['moduleOrder']);
  });

  it('leaves the Slot Map alone', () => {
    const before = withSlotMap();
    expect(dispatch(before, { type: 'recallSlot', slot: 0 }).state.slotMap).toBe(before.slotMap);
  });
});

describe('Snapshot A/B', () => {
  /** In Sync on MIDI channel 5 with a Snapshot taken, then Tilt and Character's Effect edited. */
  const edited = () =>
    run(
      onMidiChannel5(),
      { type: 'outputConnected' },
      { type: 'sendAllFinished' },
      { type: 'takeSnapshot' },
      { type: 'setParam', id: 'tilt', value: 20 },
      { type: 'selectEffect', id: 'characterEffect', effect: 'howl' },
    ).state;
  const snapshotWorking = initialEditorState().working;

  it('takes a frozen copy of the Working State, sending nothing; later edits leave it as it was', () => {
    const taken = run(onMidiChannel5(), { type: 'takeSnapshot' });
    expect(taken.messages).toEqual([]);
    expect(taken.state.snapshot).toEqual({ state: snapshotWorking, showing: false });

    expect(edited().snapshot?.state).toEqual(snapshotWorking);
    expect(shownState(edited())).toEqual(edited().working);
  });

  it('flips to the Snapshot sending only the values that differ, in Send All order, and back again', () => {
    const toA = dispatch(edited(), { type: 'flipAB' });
    expect(toA.messages).toEqual([
      [0xb4, 16, 10],
      [0xb4, 64, 64],
    ]);
    expect(shownState(toA.state)).toEqual(snapshotWorking);
    expect(toA.state.snapshot?.showing).toBe(true);
    // The Working State is still the edits, kept for flipping back.
    expect(toA.state.working.tilt).toBe(20);

    const toB = dispatch(toA.state, { type: 'flipAB' });
    expect(toB.messages).toEqual([
      [0xb4, 16, 76],
      [0xb4, 64, 20],
    ]);
    expect(shownState(toB.state)).toEqual(edited().working);
  });

  it('sends nothing when the Snapshot and the Working State are the same', () => {
    const state = run(onMidiChannel5(), { type: 'takeSnapshot' }).state;
    expect(dispatch(state, { type: 'flipAB' }).messages).toEqual([]);
  });

  it('says Bypassed again when a flip changes a Bypassed Module’s Effect, in case the pedal engaged it', () => {
    const state = run(
      onMidiChannel5(),
      { type: 'setEngaged', module: 'movement', engaged: false },
      { type: 'takeSnapshot' },
      { type: 'selectEffect', id: 'movementEffect', effect: 'phaser' },
    ).state;

    expect(dispatch(state, { type: 'flipAB' }).messages).toEqual([
      [0xb4, 17, 10],
      [0xb4, 104, 0],
    ]);
  });

  it('keeps the Sync Status: a flip is live sends', () => {
    const state = dispatch(edited(), { type: 'flipAB' }).state;
    expect(syncStatus(state)).toBe('inSync');

    const stale = run(onMidiChannel5(), { type: 'outputConnected' }, { type: 'takeSnapshot' }, { type: 'setParam', id: 'mix', value: 3 }).state;
    expect(syncStatus(dispatch(stale, { type: 'flipAB' }).state)).toBe('possiblyStale');
  });

  it('ignores every edit and undo while the Snapshot is showing, so it stays frozen', () => {
    const showing = dispatch(edited(), { type: 'flipAB' }).state;
    const edits: EditorAction[] = [
      { type: 'setParam', id: 'mix', value: 3 },
      { type: 'selectEffect', id: 'textureEffect', effect: 'squash' },
      { type: 'setEngaged', module: 'texture', engaged: false },
      { type: 'selectChoice', id: 'filterStyle', choice: 'lowpass' },
      { type: 'setModuleOrder', order: ['texture', 'diffusion', 'movement', 'character'] },
      { type: 'undo' },
      { type: 'redo' },
      { type: 'takeSnapshot' },
    ];
    for (const action of edits) expect(dispatch(showing, action)).toEqual({ state: showing, messages: [] });
  });

  it('sends no bytes for a Pedal Step setting that differs, and says the comparison isn’t exact for it', () => {
    const state = run(
      edited(),
      { type: 'setModuleOrder', order: ['texture', 'diffusion', 'movement', 'character'] },
      { type: 'confirmPedalStep', id: 'moduleOrder' },
    ).state;
    expect(inexactPedalSteps(state)).toEqual(['moduleOrder']);
    expect(inexactPedalSteps(edited())).toEqual([]);

    const toA = dispatch(state, { type: 'flipAB' });
    expect(toA.messages).toEqual([
      [0xb4, 16, 10],
      [0xb4, 64, 64],
    ]);
    // The pedal still has the Working State's Module Order, not the Snapshot's.
    expect(unconfirmedPedalSteps(toA.state)).toEqual(['moduleOrder']);
    expect(syncStatus(toA.state)).toBe('possiblyStale');
    expect(syncStatus(dispatch(toA.state, { type: 'flipAB' }).state)).toBe('inSync');
  });

  it('confirms the Snapshot’s Pedal Step setting while it is showing, as that is what the pedal now has', () => {
    const state = run(
      onMidiChannel5(),
      { type: 'takeSnapshot' },
      { type: 'setModuleOrder', order: ['texture', 'diffusion', 'movement', 'character'] },
      { type: 'confirmPedalStep', id: 'moduleOrder' },
      { type: 'flipAB' },
      { type: 'confirmPedalStep', id: 'moduleOrder' },
    ).state;
    expect(state.confirmed.moduleOrder).toBe(0);
    expect(unconfirmedPedalSteps(state)).toEqual([]);
  });

  it('Sends All the Snapshot while it is showing', () => {
    const showing = dispatch(edited(), { type: 'flipAB' }).state;
    expect(encodeSendAll(showing)).toEqual(encodeSendAll(onMidiChannel5()));
  });

  it('adopts the Snapshot as the Working State, sending what differs, as one step undo can take back', () => {
    const adopted = dispatch(edited(), { type: 'adoptSnapshot' });
    expect(adopted.messages).toEqual([
      [0xb4, 16, 10],
      [0xb4, 64, 64],
    ]);
    expect(adopted.state.working).toEqual(snapshotWorking);
    expect(adopted.state.snapshot).toBeNull();
    expect(syncStatus(adopted.state)).toBe('inSync');

    const undone = dispatch(adopted.state, { type: 'undo' });
    expect(undone.state.working).toEqual(edited().working);
    expect(undone.messages).toEqual(expect.arrayContaining([[0xb4, 16, 76], [0xb4, 64, 20]]));
  });

  it('adopts the Snapshot while it is showing without sending anything: the pedal already sounds it', () => {
    const showing = dispatch(edited(), { type: 'flipAB' }).state;
    const adopted = dispatch(showing, { type: 'adoptSnapshot' });

    expect(adopted.messages).toEqual([]);
    expect(adopted.state.working).toEqual(snapshotWorking);
    expect(adopted.state.snapshot).toBeNull();
  });

  it('discards the Snapshot, flipping back to the Working State first if it is showing', () => {
    const notShowing = dispatch(edited(), { type: 'discardSnapshot' });
    expect(notShowing.messages).toEqual([]);
    expect(notShowing.state.snapshot).toBeNull();
    expect(notShowing.state.working).toEqual(edited().working);

    const showing = dispatch(dispatch(edited(), { type: 'flipAB' }).state, { type: 'discardSnapshot' });
    expect(showing.messages).toEqual([
      [0xb4, 16, 76],
      [0xb4, 64, 20],
    ]);
    expect(showing.state.snapshot).toBeNull();
    expect(shownState(showing.state)).toEqual(edited().working);
  });

  it('does nothing to flip, adopt or discard without a Snapshot', () => {
    const state = onMidiChannel5();
    for (const type of ['flipAB', 'adoptSnapshot', 'discardSnapshot'] as const) {
      expect(dispatch(state, { type })).toEqual({ state, messages: [] });
    }
  });

  it('retakes the Snapshot from the Working State when one is already held', () => {
    const state = dispatch(edited(), { type: 'takeSnapshot' }).state;
    expect(state.snapshot).toEqual({ state: edited().working, showing: false });
  });

  it('is discarded when another Working State is loaded or a Slot recalled, so adopting can’t overwrite them', () => {
    const showing = dispatch(edited(), { type: 'flipAB' }).state;
    const loaded = dispatch(showing, { type: 'loadWorking', working: { ...snapshotWorking, mix: 9 } }).state;
    expect(loaded.snapshot).toBeNull();
    expect(shownState(loaded).mix).toBe(9);

    const recalled = dispatch(showing, { type: 'recallSlot', slot: 0 }).state;
    expect(recalled.snapshot).toBeNull();
    expect(shownState(recalled)).toEqual(edited().working);
  });
});

describe('restore', () => {
  const working = { ...initialEditorState().working, tilt: 20, moduleOrder: 3 };
  const session = {
    working,
    snapshot: { state: { ...working, mix: 40 }, showing: true },
    slotMap: { 12: { committed: working, presetId: 'p-1', name: 'Shimmer' } },
    confirmed: { moduleOrder: 3 },
    midiChannel: 9,
  };
  const connected = () => dispatch(onMidiChannel5(), { type: 'outputConnected' }).state;

  it('takes up what the last session left, sending nothing', () => {
    const { state, messages } = dispatch(connected(), { type: 'restore', ...session });

    const { midiChannel, ...rest } = session;
    expect(state).toMatchObject({ ...rest, global: { midiChannel } });
    expect(messages).toEqual([]);
  });

  it('is Possibly Stale even after Send All, since the pedal may have changed since, but stays Unknown with no output', () => {
    const inSync = dispatch(connected(), { type: 'sendAllFinished' }).state;
    expect(syncStatus(dispatch(inSync, { type: 'restore', ...session }).state)).toBe('possiblyStale');

    expect(syncStatus(dispatch(onMidiChannel5(), { type: 'restore', ...session }).state)).toBe('unknown');
  });

  it('clears the undo history, whose steps belong to the state before it', () => {
    const edited = dispatch(onMidiChannel5(), { type: 'setParam', id: 'tilt', value: 30 }).state;
    const restored = dispatch(edited, { type: 'restore', ...session }).state;

    expect(dispatch(restored, { type: 'undo' })).toEqual({ state: restored, messages: [] });
  });
});
