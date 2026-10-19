// All pedal knowledge lives here (ADR 0002): the single source of MIDI truth (manual §16). UI code must never read CC
// numbers directly; it goes through this map.

/** The pedal's factory MIDI channel. */
export const DEFAULT_MIDI_CHANNEL = 1;

/**
 * The pedal's own USB port is "HOLOGRAM Chroma Console MIDI". Matched loosely: operating systems add prefixes and suffixes
 * such as "2- " or " 1".
 */
export const PEDAL_PORT_NAME = /chroma console/i;

export const MODULES = {
  character: 'Character',
  movement: 'Movement',
  diffusion: 'Diffusion',
  texture: 'Texture',
} as const;

export type ModuleId = keyof typeof MODULES;

/** The Modules in their default Module Order, which is also the order of their buttons, A to D. */
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** Four Modules can process the signal in 4! orders. */
const MODULE_ORDER_COUNT = 24;

/**
 * The Module Order a permutation index stands for. The 24 orders are numbered in dictionary order of the default one,
 * so 0 is Character → Movement → Diffusion → Texture and 23 is the reverse.
 */
export function moduleOrderAt(index: number): ModuleId[] {
  const remaining = [...MODULE_IDS];
  const order: ModuleId[] = [];
  let rest = index;
  for (let n = remaining.length; n > 0; n--) {
    const stride = factorial(n - 1);
    order.push(remaining.splice(Math.floor(rest / stride), 1)[0]!);
    rest %= stride;
  }
  return order;
}

/** The permutation index of a Module Order; undefined unless it holds each of the four Modules once. */
export function moduleOrderIndex(order: readonly ModuleId[]): number | undefined {
  if (order.length !== MODULE_IDS.length || MODULE_IDS.some((m) => !order.includes(m))) return undefined;
  const remaining = [...MODULE_IDS];
  return order.reduce((index, module, i) => {
    const position = remaining.indexOf(module);
    remaining.splice(position, 1);
    return index + position * factorial(order.length - 1 - i);
  }, 0);
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/** The Module Order a Working State holds. */
export function moduleOrderOf(working: Readonly<Record<'moduleOrder', number>>): ModuleId[] {
  return moduleOrderAt(working.moduleOrder);
}

/** A control whose meaning changes with its Module's Effect, named by the knob it is on the pedal. */
export type ControlRole = 'amount' | 'tilt' | 'sensitivity' | 'rate' | 'time' | 'drift';

/** What a control does under one Effect, as the manual describes it. */
export type EffectControl = {
  /** A few words shown under the control's label, e.g. "pitch" for Rate under Pitch. */
  meaning: string;
  help: string;
  /** Read in octaves, −1 at the left, 0 at centre and +1 at the right (Pitch's Rate, Reverse's Time). */
  octaves?: true;
};

/** One named value of a CC: the range the pedal reads as it, and the value in that range the editor sends. */
export type ChoiceDef = {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  help?: string;
};

/** One Effect a Module can host: the CC range that selects it, its midpoint, which is what the editor sends, and what its controls do. */
export type EffectDef = ChoiceDef & {
  help: string;
  controls: Partial<Record<ControlRole, EffectControl>>;
};

export type ParamDef = {
  id: string;
  label: string;
  /** None for a Pedal Step setting, which MIDI can't reach. */
  cc?: number;
  /**
   * `continuous`: any of 0–127, sent as-is. `effect`: one of a Module's Effects, sent as the midpoint of its range.
   * `choice`: one of a few named settings, such as Engaged or Bypassed, each sent as its own value.
   * `moduleOrder`: one of the 24 orders of the four Modules, as a permutation index (see `moduleOrderOf`).
   */
  kind: 'continuous' | 'effect' | 'choice' | 'moduleOrder';
  effects?: readonly EffectDef[];
  choices?: readonly ChoiceDef[];
  /** The Module the control drives: Tilt is Character's, as its red knob shows. Output Level drives the whole pedal. */
  module?: ModuleId;
  /** Which of its Module's Effect's controls this is, when its meaning follows the Effect. */
  role?: ControlRole;
  /**
   * `fxSetup`: saved in the Preset, but set on the pedal in its FX Setup menu, such as Filter style. `pedalStep`: set
   * only by hand on the pedal, so never sent.
   */
  group: 'effect' | 'engaged' | 'primary' | 'secondary' | 'fxSetup' | 'pedalStep';
  scope: 'preset';
  min: number;
  max: number;
  default: number;
  /** A neutral centre the knob marks and snaps back to on double-click (e.g. Tilt's neutral EQ). */
  detent?: number;
  /** What turning toward each end of the sweep does, for a control neutral at centre. */
  sides?: readonly [string, string];
  help: string;
  /** How the setting reaches the pedal: a CC, or a Pedal Step the user performs and then confirms. */
  transport: 'cc' | 'pedalStep';
};

/** Each Effect of a Module takes 22 values of its CC from 0, in order; 110–127 is OFF, which the editor never sends. */
const EFFECT_RANGE = 22;

const effect = <Id extends string>(id: Id, label: string, index: number, help: string, controls: EffectDef['controls']) => {
  const min = index * EFFECT_RANGE;
  const max = min + EFFECT_RANGE - 1;
  return { id, label, min, max, value: Math.floor((min + max) / 2), help, controls } satisfies EffectDef;
};

const effectSelection = <Id extends string, const E extends readonly EffectDef[]>(id: Id, cc: number, module: ModuleId, effects: E, help: string) =>
  ({
    id,
    label: 'Effect',
    cc,
    kind: 'effect',
    effects,
    module,
    group: 'effect',
    scope: 'preset',
    min: effects[0]!.min,
    max: effects.at(-1)!.max,
    default: effects[0]!.value,
    help,
    transport: 'cc',
  }) as const;

const NEUTRAL = 64;

type ChoiceOptions<C extends readonly ChoiceDef[]> = { group: 'engaged' | 'fxSetup'; default: C[number]['id']; module?: ModuleId };

/** A control chosen from a few named values, which split the CC's 0–127 between them. */
const choice = <Id extends string, const C extends readonly ChoiceDef[]>(id: Id, label: string, cc: number, choices: C, help: string, options: ChoiceOptions<C>) =>
  ({
    id,
    label,
    cc,
    kind: 'choice',
    choices,
    ...(options.module && { module: options.module }),
    group: options.group,
    scope: 'preset',
    min: 0,
    max: 127,
    default: choices.find((c) => c.id === options.default)!.value,
    help,
    transport: 'cc',
  }) as const;

/** Bypassed below 64, Engaged from 64; the editor sends 0 and 127. A Bypassed Module keeps its Effect. */
const ENGAGED_CHOICES = [
  { id: 'bypassed', label: 'Bypassed', min: 0, max: 63, value: 0 },
  { id: 'engaged', label: 'Engaged', min: 64, max: 127, value: 127 },
] as const satisfies readonly ChoiceDef[];

const engaged = <Id extends string>(id: Id, cc: number, module: ModuleId) =>
  choice(id, 'Engaged', cc, ENGAGED_CHOICES, `Whether the ${MODULES[module]} Module is processing. Bypassed, it keeps its Effect.`, {
    group: 'engaged',
    default: 'engaged',
    module,
  });

/** The three Filter styles split CC 84 into thirds; the editor sends each third's midpoint. */
const FILTER_STYLES = [
  { id: 'lowpass', label: 'Lowpass', min: 0, max: 43, value: 21, help: 'A standalone low-pass filter: turn Amount left to cut high frequencies.' },
  { id: 'tilt', label: 'Tilt', min: 44, max: 87, value: 65, help: 'The default: turn Amount left to cut high frequencies, right to cut low frequencies.' },
  { id: 'highpass', label: 'Highpass', min: 88, max: 127, value: 107, help: 'A standalone high-pass filter: turn Amount right to cut low frequencies.' },
] as const satisfies readonly ChoiceDef[];

const CAPTURE_ROUTINGS = [
  { id: 'postFx', label: 'Post-FX', min: 0, max: 63, value: 0, help: 'The default: Capture records after the effects.' },
  { id: 'preFx', label: 'Pre-FX', min: 64, max: 127, value: 127, help: 'Capture records your dry signal before the effects, so the effects process the loop.' },
] as const satisfies readonly ChoiceDef[];

type LevelOptions = { module?: ModuleId; role?: ControlRole; default?: number; sides?: readonly [string, string] };

/** A 0–127 knob. One with `sides` is neutral at centre, which is where it starts and resets to. */
const level = <Id extends string>(id: Id, label: string, cc: number, group: 'primary' | 'secondary', help: string, options: LevelOptions) =>
  ({
    id,
    label,
    cc,
    kind: 'continuous',
    group,
    scope: 'preset',
    min: 0,
    max: 127,
    default: options.default ?? NEUTRAL,
    ...(options.sides && { detent: NEUTRAL }),
    ...options,
    help,
    transport: 'cc',
  }) as const;

const CUT_BOOST = ['Cut', 'Boost'] as const;
const OCTAVES = ['−1 oct', '+1 oct'] as const;

const CHARACTER_EFFECTS = [
  effect('drive', 'Drive', 0, 'Tube-like drive, from warm preamp to full overdrive.', {
    amount: { meaning: 'overdrive', help: 'The intensity of the overdrive.' },
  }),
  effect('sweeten', 'Sweeten', 1, 'A preamp that adds EQ, compression and gentle saturation as Amount rises.', {
    amount: { meaning: 'compression, saturation', help: 'Compression and saturation: subtle sweetening low, light overdrive high.' },
  }),
  effect('fuzz', 'Fuzz', 2, 'Dynamic vintage-voiced fuzz, from smooth and rounded to brash blown-speaker sounds.', {
    amount: { meaning: 'fuzz', help: 'The intensity of the fuzz.' },
    tilt: { meaning: 'tone, bias', help: 'Tone, and the transient and bias of the fuzz: neutral at centre, darker left, brighter right.' },
  }),
  effect('howl', 'Howl', 3, 'Resonant filter fuzz: smooth sustaining tones or synth-like stabs.', {
    amount: { meaning: 'howl', help: 'The intensity of the Howl.' },
    tilt: { meaning: 'tone, voice', help: 'Tone, and whether Howl sustains smoothly or stabs: neutral at centre, darker left, brighter right.' },
  }),
  effect('swell', 'Swell', 4, 'Envelope-triggered volume swells; leave space between notes to trigger them.', {
    amount: { meaning: 'attack, decay', help: 'The attack and decay times of the swells.' },
    sensitivity: { meaning: 'trigger', help: 'The triggering threshold: how readily your playing sets off a swell. Neutral at centre.' },
  }),
] as const;

const MOVEMENT_EFFECTS = [
  effect('doubler', 'Doubler', 0, 'Stereo double tracking, from tight doubling to short slap-back.', {
    rate: { meaning: 'doubling time', help: 'The doubling time, from short to long.' },
    amount: { meaning: 'doubling', help: 'Mixes in more doubling as it rises.' },
    drift: { meaning: 'pitch shifts', help: 'Random momentary pitch shifts, more intense as it rises.' },
  }),
  effect('vibrato', 'Vibrato', 1, 'Pitch modulation, from classic sine-wave vibrato to tape-like random warble.', {
    rate: { meaning: 'speed', help: 'The frequency of the pitch modulation.' },
    amount: { meaning: 'depth', help: 'The modulation depth.' },
    drift: { meaning: 'warble, width', help: 'Widens the stereo image and moves toward a random, tape-warble waveform.' },
  }),
  effect('phaser', 'Phaser', 2, 'Vintage-voiced phaser, from swirling sweeps to pulsing vibrato-like undulation.', {
    rate: { meaning: 'speed', help: 'The phase-shifting frequency.' },
    amount: { meaning: 'intensity, stages', help: 'Modulation intensity, adding phase-shifting stages from 2 up to 12.' },
    drift: { meaning: 'randomness', help: 'Randomness in the phase-shifting waveform.' },
  }),
  effect('tremolo', 'Tremolo', 3, 'Amplitude modulation, from amp shimmer to hard square-wave chop.', {
    rate: { meaning: 'speed', help: 'The amplitude modulation frequency.' },
    amount: { meaning: 'depth', help: 'The tremolo depth, from soft flutter to choppy rhythm.' },
    drift: { meaning: 'instability', help: 'Randomness, variation and instability in the tremolo.' },
  }),
  effect('pitch', 'Pitch', 4, 'Pitch shifting from −1 octave to +1 octave.', {
    rate: { meaning: 'pitch', help: 'The pitch: −1 octave fully left, no shift at centre, +1 octave fully right, gliding between.', octaves: true },
    amount: { meaning: 'pitch mix', help: 'The mix of the pitch-shifted signal; 100% wet fully clockwise.' },
    drift: { meaning: 'lo-fi', help: 'Lowers the pitch shifter’s resolution and adds instability; works even with no shift.' },
  }),
] as const;

const DIFFUSION_EFFECTS = [
  effect('cascade', 'Cascade', 0, 'A bucket-brigade style analog delay, but heightened; darker, with subtle modulation.', {
    time: { meaning: 'delay time', help: 'The delay time, from short slapback to quarter-note taps; tapped tempos are quantised.' },
    amount: { meaning: 'feedback', help: 'Repeats and feedback, up to self-oscillation at maximum.' },
    drift: { meaning: 'degradation', help: 'Pitch modulation, instability and degradation of the repeats.' },
  }),
  effect('reels', 'Reels', 1, 'A well-worn tape echo: gritty, bright and slightly wonky.', {
    time: { meaning: 'delay time', help: 'The delay time, from short slapback to quarter-note taps.' },
    amount: { meaning: 'feedback', help: 'Repeats and feedback; lively self-oscillation at 100%.' },
    drift: { meaning: 'tape wear', help: 'Instability and degradation of the tape; repeats disintegrate as they recycle.' },
  }),
  effect('space', 'Space', 2, 'Reverb blending five sounds, from tight echo chambers to huge sustaining clouds.', {
    time: { meaning: 'size, tone', help: 'The reverb size and tonality; larger clockwise.' },
    amount: { meaning: 'reverb mix', help: 'The wet/dry mix of the reverb; 100% wet fully clockwise.' },
    drift: { meaning: 'pitch modulation', help: 'Pitch modulation at various stages of the reverb.' },
  }),
  effect('collage', 'Collage', 3, 'Wild looping delay that edits the delay line as Time moves.', {
    time: { meaning: 'subdivision', help: 'The delay subdivision, from short granular samples to long loop-like phrases.' },
    amount: { meaning: 'feedback', help: 'Repeats and feedback, evolving into oscillation at maximum.' },
    drift: { meaning: 'loops', help: 'Random double-speed loops, and more pitch modulation.' },
  }),
  effect('reverse', 'Reverse', 4, 'Reverse delay with variable playback speed and pitch, −1 to +1 octave.', {
    time: { meaning: 'speed / pitch', help: 'Playback speed: half speed (−1 octave) fully left, normal at centre, double (+1 octave) fully right.', octaves: true },
    amount: { meaning: 'delay mix', help: 'The wet/dry mix of the delay; 100% wet fully clockwise.' },
    drift: { meaning: 'pitch modulation', help: 'Pitch modulation of the repeats.' },
  }),
] as const;

const TEXTURE_EFFECTS = [
  effect('filter', 'Filter', 0, 'Multi-mode filter: Tilt by default, or lowpass or highpass (Filter style).', {
    amount: { meaning: 'cutoff', help: 'The cutoff frequency. Tilt style: neutral at centre. Lowpass: neutral fully clockwise. Highpass: neutral fully counter-clockwise.' },
  }),
  effect('squash', 'Squash', 1, 'A heavy-handed compressor and overdrive, from subtle polish to grit.', {
    amount: { meaning: 'compression, drive', help: 'More compression, overdriving as it nears fully clockwise.' },
  }),
  effect('cassette', 'Cassette', 2, 'Wow, flutter, warble and tape degradation from cassette recorders.', {
    amount: { meaning: 'tape', help: 'Tape saturation, compression, filtering and artifacts, with different flavours across the range.' },
  }),
  effect('broken', 'Broken', 3, 'Pitch drops with amplitude and frequency modulation: motorised gear in need of service.', {
    amount: { meaning: 'breakdown', help: 'The breakdown, at full intensity fully clockwise.' },
  }),
  effect('interference', 'Interference', 4, 'A dissolving layer of glitches, radio static and interference.', {
    amount: { meaning: 'interference', help: 'Moves through flavours of interference, more intense clockwise.' },
  }),
] as const;

const effectVol = <Id extends string>(id: Id, cc: number, module: ModuleId, help = `The output volume of the ${MODULES[module]} Module. Neutral at centre.`) =>
  level(id, 'Effect Vol', cc, 'secondary', help, { module, sides: CUT_BOOST });

const drift = <Id extends string>(id: Id, cc: number, module: ModuleId) =>
  level(id, 'Drift', cc, 'secondary', 'Randomness, instability and nostalgic warble in the Effect, from none at 0%.', { module, role: 'drift', default: 0 });

export const PARAMS = {
  characterEffect: effectSelection('characterEffect', 16, 'character', CHARACTER_EFFECTS, 'Overdrive, compression, fuzz and swell effects: Drive, Sweeten, Fuzz, Howl or Swell.'),
  movementEffect: effectSelection('movementEffect', 17, 'movement', MOVEMENT_EFFECTS, 'Modulation effects: Doubler, Vibrato, Phaser, Tremolo or Pitch.'),
  diffusionEffect: effectSelection('diffusionEffect', 18, 'diffusion', DIFFUSION_EFFECTS, 'Delay and reverb effects: Cascade, Reels, Space, Collage or Reverse.'),
  textureEffect: effectSelection('textureEffect', 19, 'texture', TEXTURE_EFFECTS, 'Textural effects: Filter, Squash, Cassette, Broken or Interference.'),
  tilt: level('tilt', 'Tilt', 64, 'primary', 'The tone of the Character Effect: neutral at centre, darker to the left, brighter to the right. Also shapes the saturation.', {
    module: 'character',
    role: 'tilt',
    sides: ['Dark', 'Bright'],
  }),
  // The manual sets no starting point for Amount, Rate or Time, so they start at noon like Tilt.
  characterAmount: level('characterAmount', 'Amount', 65, 'primary', 'How much of the Character Effect.', { module: 'character', role: 'amount' }),
  rate: level('rate', 'Rate', 66, 'primary', 'The speed of the Movement Effect.', { module: 'movement', role: 'rate' }),
  movementAmount: level('movementAmount', 'Amount', 67, 'primary', 'How much of the Movement Effect.', { module: 'movement', role: 'amount' }),
  time: level('time', 'Time', 68, 'primary', 'The time of the Diffusion Effect.', { module: 'diffusion', role: 'time' }),
  diffusionAmount: level('diffusionAmount', 'Amount', 69, 'primary', 'How much of the Diffusion Effect.', { module: 'diffusion', role: 'amount' }),
  // Mix sits in Texture's column on the pedal, but blends the whole chain; the manual suggests starting at 100%.
  mix: level('mix', 'Mix', 70, 'primary', 'Blends your dry input with the effected signal; 100% is fully effected, the simplest place to start.', {
    module: 'texture',
    default: 127,
  }),
  textureAmount: level('textureAmount', 'Amount', 71, 'primary', 'How much of the Texture Effect.', { module: 'texture', role: 'amount' }),
  sensitivity: level('sensitivity', 'Sensitivity', 72, 'secondary', 'Fine-tunes the Calibration headroom for the Character Module: your breakup point for the drive Effects. Neutral at centre.', {
    module: 'character',
    role: 'sensitivity',
    sides: ['Less', 'More'],
  }),
  characterEffectVol: effectVol('characterEffectVol', 73, 'character'),
  movementDrift: drift('movementDrift', 74, 'movement'),
  movementEffectVol: effectVol('movementEffectVol', 75, 'movement'),
  diffusionDrift: drift('diffusionDrift', 76, 'diffusion'),
  diffusionEffectVol: effectVol('diffusionEffectVol', 77, 'diffusion', 'The volume of the Diffusion Module’s wet signal only, against the dry. Neutral at centre.'),
  outputLevel: level('outputLevel', 'Output Level', 78, 'secondary', 'Cuts or boosts the volume of the pedal’s effected output. Neutral at centre.', { sides: CUT_BOOST }),
  textureEffectVol: effectVol('textureEffectVol', 79, 'texture'),
  characterEngaged: engaged('characterEngaged', 103, 'character'),
  movementEngaged: engaged('movementEngaged', 104, 'movement'),
  diffusionEngaged: engaged('diffusionEngaged', 105, 'diffusion'),
  textureEngaged: engaged('textureEngaged', 106, 'texture'),
  filterStyle: choice('filterStyle', 'Filter style', 84, FILTER_STYLES, 'How the Texture Module’s Filter Effect shapes the tone: Tilt, Lowpass or Highpass.', {
    group: 'fxSetup',
    default: 'tilt',
    module: 'texture',
  }),
  captureRouting: choice('captureRouting', 'Capture Routing', 83, CAPTURE_ROUTINGS, 'Where Capture records in the chain: after the effects or before them.', {
    group: 'fxSetup',
    default: 'postFx',
  }),
  moduleOrder: {
    id: 'moduleOrder',
    label: 'Module Order',
    kind: 'moduleOrder',
    group: 'pedalStep',
    scope: 'preset',
    min: 0,
    max: MODULE_ORDER_COUNT - 1,
    default: 0,
    help: 'The order the four Modules process the signal in. MIDI can’t set it: apply it on the pedal in FX Setup.',
    transport: 'pedalStep',
  },
} as const satisfies Record<string, ParamDef>;

export type ParamId = keyof typeof PARAMS;

/** Params saved in a Preset, and so held in the Working State. */
export type PresetParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['scope'] extends 'preset' ? K : never;
}[ParamId];

/** Every param saved in a Preset, in `PARAMS` order. */
export const PRESET_PARAMS: readonly ParamDef[] = (Object.values(PARAMS) as ParamDef[]).filter((p) => p.scope === 'preset');

/** A Module's Effect selection (CC 16–19). */
export type EffectParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['kind'] extends 'effect' ? K : never;
}[ParamId];

/** A setting chosen from a few named values: Engaged/Bypassed, Filter style, Capture routing. */
export type ChoiceParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['kind'] extends 'choice' ? K : never;
}[ParamId];

/** A Preset setting MIDI can't reach, which the user applies on the pedal by a Pedal Step. */
export type PedalStepParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['transport'] extends 'pedalStep' ? K : never;
}[ParamId];

/** A Preset setting sent as a CC. */
export type CcParamId = Exclude<PresetParamId, PedalStepParamId>;

/** A 0–127 knob. */
export type LevelParamId = Exclude<CcParamId, EffectParamId | ChoiceParamId>;

export const PEDAL_STEP_PARAMS = (Object.values(PARAMS) as ParamDef[]).filter((p) => p.transport === 'pedalStep').map((p) => p.id as PedalStepParamId);

/** The pedal's four buttons, left to right, and its two footswitches, as the manual names them. */
export const PEDAL_CONTROLS = { a: 'A', b: 'B', c: 'C', d: 'D', tap: 'TAP', bypass: 'BYPASS' } as const;

export type PedalControlId = keyof typeof PEDAL_CONTROLS;

/** Each Module's button, which also selects its Effect. The letters are to be confirmed by hardware check 11. */
export const MODULE_BUTTONS = { character: 'a', movement: 'b', diffusion: 'c', texture: 'd' } as const satisfies Record<ModuleId, PedalControlId>;

/**
 * One move of a Pedal Step: pressing and releasing (`press`) or holding down (`hold`) one control, or several together
 * as a combination.
 */
export type PedalMove = { action: 'press' | 'hold'; controls: readonly PedalControlId[]; text: string };

/** What the user does by hand on the pedal to apply a setting MIDI can't reach: moves made in sequence. */
export type PedalStep = { title: string; moves: readonly PedalMove[] };

const controlNames = (controls: readonly PedalControlId[]) => controls.map((c) => PEDAL_CONTROLS[c]).join(' and ');

const enterFxSetup: PedalMove = {
  action: 'press',
  controls: ['a', 'd'],
  text: `Press ${controlNames(['a', 'd'])} together to enter FX Setup. The buttons show the current Module Order, then blink blue.`,
};

/** The Pedal Step that applies `id`'s value from the Working State `working` (manual §11). */
export function pedalStep(id: PedalStepParamId, working: Readonly<Record<PedalStepParamId, number>>): PedalStep {
  switch (id) {
    case 'moduleOrder': {
      const order = moduleOrderOf(working);
      return {
        title: 'Set the Module Order',
        moves: [
          enterFxSetup,
          ...order.map((module, i): PedalMove => {
            const button = MODULE_BUTTONS[module];
            const last = i === order.length - 1 ? ' The pedal leaves FX Setup.' : '';
            return { action: 'press', controls: [button], text: `Tap ${PEDAL_CONTROLS[button]} (${MODULES[module]}).${last}` };
          }),
        ],
      };
    }
  }
}

/** The Effect ids an Effect selection offers, e.g. 'howl'. */
export type EffectId<P extends EffectParamId = EffectParamId> = (typeof PARAMS)[P]['effects'][number]['id'];

/** The choice ids a setting offers, e.g. 'lowpass'. */
export type ChoiceId<P extends ChoiceParamId = ChoiceParamId> = (typeof PARAMS)[P]['choices'][number]['id'];

/** Each Module's Engaged/Bypassed (CC 103–106). */
export const ENGAGED_PARAMS = {
  character: 'characterEngaged',
  movement: 'movementEngaged',
  diffusion: 'diffusionEngaged',
  texture: 'textureEngaged',
} as const satisfies Record<ModuleId, ChoiceParamId>;

/** Whether the Working State `working` has `module` Engaged. */
export function isEngaged(working: Readonly<Record<PresetParamId, number>>, module: ModuleId): boolean {
  const id = ENGAGED_PARAMS[module];
  return choiceAt(PARAMS[id], working[id])?.id === 'engaged';
}

/** The FX Setup controls that belong to `module`'s column (Filter style for Texture), or to no Module. */
export function fxSetupParams(module?: ModuleId): ChoiceParamId[] {
  return (Object.values(PARAMS) as ParamDef[])
    .filter((p) => p.group === 'fxSetup' && p.module === module)
    .map((p) => p.id as ChoiceParamId);
}

const byCc = new Map<number, ParamDef>((Object.values(PARAMS) as ParamDef[]).flatMap((p) => (p.cc === undefined ? [] : [[p.cc, p]])));

export function paramByCc(cc: number): ParamDef | undefined {
  return byCc.get(cc);
}

/** The Effect a value of an Effect selection's CC selects, as the pedal reads it; undefined for OFF (110–127). */
export function effectAt(param: ParamDef, value: number): EffectDef | undefined {
  return param.effects?.find((e) => value >= e.min && value <= e.max);
}

/** The named value of an Effect selection or choice that `value` falls in, as the pedal reads it. */
export function choiceAt(param: ParamDef, value: number): ChoiceDef | undefined {
  return (param.effects ?? param.choices)?.find((c) => value >= c.min && value <= c.max);
}

/**
 * What a control is set to, as the pedal names it: an Effect (or OFF for 110–127), a choice such as Bypassed, or a
 * Module Order such as "Character → Movement → Diffusion → Texture"; undefined for a plain level.
 */
export function settingLabel(param: ParamDef, value: number): string | undefined {
  if (param.kind === 'continuous') return undefined;
  if (param.kind === 'moduleOrder') return moduleOrderAt(value).map((m) => MODULES[m]).join(' → ');
  return choiceAt(param, value)?.label ?? 'OFF';
}

/**
 * Rounds and clamps a value into the range the parameter accepts. An Effect selection or choice snaps to the value
 * the editor sends for the one whose range holds it, so an Effect selection never lands in OFF.
 */
export function clampToParam(param: ParamDef, value: number): number {
  const v = Math.min(param.max, Math.max(param.min, Math.round(value)));
  return param.kind === 'effect' || param.kind === 'choice' ? choiceAt(param, v)!.value : v;
}

/** The Effect selection of each Module. */
const EFFECT_PARAMS = Object.fromEntries(
  (Object.values(PARAMS) as ParamDef[]).filter((p) => p.kind === 'effect').map((p) => [p.module, p]),
) as Record<ModuleId, ParamDef>;

/** A knob as the pedal would describe it, given what the Working State has selected. */
export type ControlReading = {
  /** What the control does under the selected Effect, e.g. "pitch" for Rate under Pitch; undefined when it never changes. */
  meaning?: string;
  help: string;
  /** The value in the pedal's own terms: "neutral", "−25%", "+0.5 oct", "100%". */
  readout: string;
  /** What each end of the sweep does, for a control neutral at centre. */
  sides?: readonly [string, string];
};

const MINUS = '−';

/** −1 to +1 either side of the centre, so both ends reach exactly 1 though the centre (64) is not midway. */
function fromCentre(value: number) {
  return (value - NEUTRAL) / (value < NEUTRAL ? NEUTRAL : 127 - NEUTRAL);
}

function signed(amount: number, digits: number) {
  const text = String(Number(Math.abs(amount).toFixed(digits)));
  return `${amount < 0 ? MINUS : '+'}${text}`;
}

/** How a knob reads with the Working State `working`: its meaning and help follow its Module's selected Effect. */
export function readControl(id: LevelParamId, working: Readonly<Record<PresetParamId, number>>): ControlReading {
  const param: ParamDef = PARAMS[id];
  const value = working[id];
  const effectParam = param.role && param.module ? EFFECT_PARAMS[param.module] : undefined;
  const control = effectParam && param.role ? effectAt(effectParam, working[effectParam.id as EffectParamId])?.controls[param.role] : undefined;
  const help = control?.help ?? param.help;
  if (control?.octaves) {
    const readout = value === NEUTRAL ? '0 oct' : `${signed(fromCentre(value), 2)} oct`;
    return { meaning: control.meaning, help, readout, sides: OCTAVES };
  }
  const readout =
    param.detent === undefined
      ? `${Math.round((value / param.max) * 100)}%`
      : value === param.detent
        ? 'neutral'
        : `${signed(Math.round(fromCentre(value) * 100), 0)}%`;
  return { meaning: control?.meaning, help, readout, sides: param.sides };
}

const SLOTS_PER_BANK = 20;
/** The four Banks of 20 Slots, in Program Change order. */
export const BANKS = ['A', 'B', 'C', 'D'] as const;
export type Bank = (typeof BANKS)[number];
/** Program Change 0 to one below this recalls a Slot. */
export const SLOT_COUNT = BANKS.length * SLOTS_PER_BANK;

/** A Slot's address, Bank + number (e.g. "D-14"), for the Program Change that recalls it; undefined past the 80 Slots. */
export function slotAddress(program: number): string | undefined {
  if (program < 0 || program >= SLOT_COUNT) return undefined;
  return `${BANKS[Math.floor(program / SLOTS_PER_BANK)]}-${(program % SLOTS_PER_BANK) + 1}`;
}

/** A Bank's Slots, each as the Program Change that recalls it. */
export function slotsInBank(bank: Bank): number[] {
  const first = BANKS.indexOf(bank) * SLOTS_PER_BANK;
  return Array.from({ length: SLOTS_PER_BANK }, (_, i) => first + i);
}

/** One button of a Performance Control: the CC it sends, the value it sends, and the range the pedal reads as it. */
export type PerformanceActionDef = ChoiceDef & { cc: number; help: string };

/**
 * A Performance Control (manual §16): a momentary MIDI action, never stored in a Preset, part of undo or sent by Send
 * All. Each of its actions sends one CC value, like pressing a footswitch.
 */
export type PerformanceControlDef = { id: string; label: string; help: string; actions: readonly PerformanceActionDef[] };

/** An action the chart gives a whole 0–127 range: the pedal acts on any value, and the editor sends 127. */
const anyValue = <Id extends string>(id: Id, label: string, cc: number, help: string) =>
  ({ id, label, cc, min: 0, max: 127, value: 127, help }) as const;

export const PERFORMANCE_CONTROLS = {
  capture: {
    id: 'capture',
    label: 'Capture',
    help: 'The sustainer and looper, as the TAP footswitch works it. Capture recordings are never saved in a Preset.',
    actions: [
      { id: 'record', label: 'Record', cc: 82, min: 88, max: 127, value: 107, help: 'Starts recording a loop, clearing any before it.' },
      { id: 'play', label: 'Play', cc: 82, min: 44, max: 87, value: 65, help: 'Stops recording and plays the loop back.' },
      { id: 'stopClear', label: 'Stop/Clear', cc: 82, min: 0, max: 43, value: 21, help: 'Stops the loop and clears it.' },
    ],
  },
  gesture: {
    id: 'gesture',
    label: 'Gesture',
    help: 'Recordings of Primary Control knob movements, looped. The pedal saves them in a Slot; the editor’s Presets never hold them.',
    actions: [
      { id: 'play', label: 'Play', cc: 80, min: 0, max: 63, value: 0, help: 'Plays the Gesture recordings.' },
      { id: 'record', label: 'Record', cc: 80, min: 64, max: 127, value: 127, help: 'Starts recording knob movements.' },
      anyValue('stopErase', 'Stop/Erase', 81, 'Stops and erases the Gesture recordings.'),
    ],
  },
  tap: {
    id: 'tap',
    label: 'Tap',
    help: 'Taps the tempo, as the TAP footswitch does. Gesture recordings and tempo-synced Effects follow it.',
    actions: [anyValue('tap', 'Tap', 93, 'One tap. Tap in time to set the tempo.')],
  },
  pedal: {
    id: 'pedal',
    label: 'Pedal',
    help: 'Bypasses or engages the pedal, as the BYPASS footswitch does. Whether it follows a Dual Bypass module set is unconfirmed (hardware check 9).',
    actions: [
      { id: 'bypass', label: 'Bypass', cc: 91, min: 0, max: 63, value: 0, help: 'Bypasses the pedal.' },
      { id: 'engage', label: 'Engage', cc: 91, min: 64, max: 127, value: 127, help: 'Engages the pedal.' },
    ],
  },
  dualBypass: {
    id: 'dualBypass',
    label: 'Dual Bypass',
    help: 'For a Preset whose BYPASS footswitch is set in FX Setup to bypass only some Modules.',
    actions: [
      { id: 'totalBypass', label: 'Total Bypass', cc: 92, min: 0, max: 31, value: 15, help: 'Bypasses every Module, as double-tapping BYPASS does.' },
      { id: 'dualBypass', label: 'Dual Bypass', cc: 92, min: 32, max: 63, value: 47, help: 'Bypasses only the Modules set for Dual Bypass.' },
      { id: 'totalEngage', label: 'Total Engage', cc: 92, min: 64, max: 127, value: 127, help: 'Engages every Module.' },
    ],
  },
  calibrationMenu: {
    id: 'calibrationMenu',
    label: 'Calibration menu',
    help: 'The pedal’s Calibration menu, as holding both footswitches opens it. Play your instrument in it to calibrate automatically.',
    actions: [
      { id: 'enter', label: 'Enter', cc: 95, min: 64, max: 127, value: 127, help: 'Opens the Calibration menu; then play to calibrate.' },
      { id: 'exit', label: 'Exit', cc: 95, min: 0, max: 63, value: 0, help: 'Leaves the Calibration menu.' },
    ],
  },
} as const satisfies Record<string, PerformanceControlDef>;

export type PerformanceControlId = keyof typeof PERFORMANCE_CONTROLS;

/** The action ids a Performance Control offers, e.g. 'stopClear'. */
export type PerformanceActionId<C extends PerformanceControlId = PerformanceControlId> = (typeof PERFORMANCE_CONTROLS)[C]['actions'][number]['id'];

/** The action `action` of a Performance Control; undefined for one it doesn't offer. */
export function performanceAction(control: PerformanceControlId, action: string): PerformanceActionDef | undefined {
  return (PERFORMANCE_CONTROLS[control] as PerformanceControlDef).actions.find((a) => a.id === action);
}

/** The Global Setting the editor can set (manual §2): the pedal-wide input headroom, applied to every Preset. */
export const CALIBRATION_LEVEL = {
  id: 'calibrationLevel',
  label: 'Calibration Level',
  cc: 94,
  help: 'The input headroom for your instrument. The pedal keeps it through power cycles and applies it to every Preset; it is never saved in one.',
  choices: [
    { id: 'low', label: 'Low', min: 0, max: 31, value: 15, help: 'Lower-output guitars and basses, instrument-level synths.' },
    { id: 'medium', label: 'Medium', min: 32, max: 63, value: 47, help: 'Many guitars and basses (humbuckers, stacked pickups), electric piano, some synths.' },
    { id: 'high', label: 'High', min: 64, max: 95, value: 79, help: 'Hot-output guitars (overwound or active pickups), most line-level instruments.' },
    { id: 'veryHigh', label: 'Very High', min: 96, max: 127, value: 111, help: 'High-output line-level signals, modular.' },
  ],
} as const satisfies { id: string; label: string; cc: number; help: string; choices: readonly ChoiceDef[] };

export type CalibrationLevelId = (typeof CALIBRATION_LEVEL)['choices'][number]['id'];

/** The named values of each CC that isn't a Preset param, by the name the chart gives the command. */
const COMMANDS_BY_CC = new Map<number, { name: string; values: readonly ChoiceDef[] }>([[CALIBRATION_LEVEL.cc, { name: CALIBRATION_LEVEL.label, values: CALIBRATION_LEVEL.choices }]]);
for (const control of Object.values(PERFORMANCE_CONTROLS) as PerformanceControlDef[]) {
  for (const action of control.actions) {
    const command = COMMANDS_BY_CC.get(action.cc) ?? { name: control.label, values: [] };
    COMMANDS_BY_CC.set(action.cc, { ...command, values: [...command.values, action] });
  }
}

/**
 * What a CC and value do on the pedal, e.g. "Character → Howl" for CC 16 = 76, "Character → Bypassed" for CC 103 = 0,
 * "Filter style → Lowpass" for CC 84 = 21, "Character → Amount" for a level or "Capture → Record" for CC 82 = 107;
 * undefined for a CC not in the MIDI implementation chart. A command with one action, such as Tap, is named alone.
 */
export function describeCc(cc: number, value: number): string | undefined {
  const param = paramByCc(cc);
  if (param) {
    const setting = settingLabel(param, value) ?? param.label;
    if (param.group === 'fxSetup') return `${param.label} → ${setting}`;
    return param.module ? `${MODULES[param.module]} → ${setting}` : setting;
  }
  const command = COMMANDS_BY_CC.get(cc);
  if (!command) return undefined;
  const named = command.values.find((v) => value >= v.min && value <= v.max);
  // Tap's one action is the command itself; Dual Bypass → Dual Bypass is one of three.
  const alone = !named || (command.values.length === 1 && named.label === command.name);
  return alone ? command.name : `${command.name} → ${named.label}`;
}
