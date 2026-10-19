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
  cc: number;
  /**
   * `continuous`: any of 0–127, sent as-is. `effect`: one of a Module's Effects, sent as the midpoint of its range.
   * `choice`: one of a few named settings, such as Engaged or Bypassed, each sent as its own value.
   */
  kind: 'continuous' | 'effect' | 'choice';
  effects?: readonly EffectDef[];
  choices?: readonly ChoiceDef[];
  /** The Module the control drives: Tilt is Character's, as its red knob shows. Output Level drives the whole pedal. */
  module?: ModuleId;
  /** Which of its Module's Effect's controls this is, when its meaning follows the Effect. */
  role?: ControlRole;
  /** `fxSetup`: saved in the Preset, but set on the pedal in its FX Setup menu, such as Filter style. */
  group: 'effect' | 'engaged' | 'primary' | 'secondary' | 'fxSetup';
  scope: 'preset';
  min: number;
  max: number;
  default: number;
  /** A neutral centre the knob marks and snaps back to on double-click (e.g. Tilt's neutral EQ). */
  detent?: number;
  /** What turning toward each end of the sweep does, for a control neutral at centre. */
  sides?: readonly [string, string];
  help: string;
  /** How the setting reaches the pedal; Pedal Step settings arrive with Module Order. */
  transport: 'cc';
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
} as const satisfies Record<string, ParamDef>;

export type ParamId = keyof typeof PARAMS;

/** Params saved in a Preset, and so held in the Working State. */
export type PresetParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['scope'] extends 'preset' ? K : never;
}[ParamId];

/** A Module's Effect selection (CC 16–19). */
export type EffectParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['kind'] extends 'effect' ? K : never;
}[ParamId];

/** A setting chosen from a few named values: Engaged/Bypassed, Filter style, Capture routing. */
export type ChoiceParamId = {
  [K in ParamId]: (typeof PARAMS)[K]['kind'] extends 'choice' ? K : never;
}[ParamId];

/** A 0–127 knob. */
export type LevelParamId = Exclude<PresetParamId, EffectParamId | ChoiceParamId>;

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

const byCc = new Map<number, ParamDef>(Object.values(PARAMS).map((p) => [p.cc, p]));

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
 * What a control is set to, as the pedal names it: an Effect (or OFF for 110–127) or a choice such as Bypassed;
 * undefined for a plain level.
 */
export function settingLabel(param: ParamDef, value: number): string | undefined {
  if (param.kind === 'continuous') return undefined;
  return choiceAt(param, value)?.label ?? 'OFF';
}

/**
 * Rounds and clamps a value into the range the parameter accepts. An Effect selection or choice snaps to the value
 * the editor sends for the one whose range holds it, so an Effect selection never lands in OFF.
 */
export function clampToParam(param: ParamDef, value: number): number {
  const v = Math.min(param.max, Math.max(param.min, Math.round(value)));
  return param.kind === 'continuous' ? v : choiceAt(param, v)!.value;
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
/** Program Change 0 to one below this recalls a Slot. */
export const SLOT_COUNT = 4 * SLOTS_PER_BANK;

/** A Slot's address, Bank + number (e.g. "D-14"), for the Program Change that recalls it; undefined past the 80 Slots. */
export function slotAddress(program: number): string | undefined {
  if (program < 0 || program >= SLOT_COUNT) return undefined;
  return `${'ABCD'[Math.floor(program / SLOTS_PER_BANK)]}-${(program % SLOTS_PER_BANK) + 1}`;
}

/** A CC's values split into named bands, each given by its highest value: the bands run from 0 up to 127. */
type ValueBands = readonly (readonly [max: number, label: string])[];

/** What a CC controls, as the MIDI implementation chart (manual §16) names it, and its named values if it has any. */
type ChartEntry = { name: string; values?: ValueBands };

const halves = (low: string, high: string): ValueBands => [
  [63, low],
  [127, high],
];
const thirds = (low: string, middle: string, high: string): ValueBands => [
  [43, low],
  [87, middle],
  [127, high],
];

/**
 * The rest of the MIDI implementation chart: every CC not yet in PARAMS, for describing any message sent (the MIDI
 * Monitor). A CC leaves here when it joins PARAMS.
 */
const MIDI_CHART: Record<number, ChartEntry> = {
  80: { name: 'Gesture', values: halves('Play', 'Record') },
  81: { name: 'Gesture → Stop/Erase' },
  82: { name: 'Capture', values: thirds('Stop/Clear', 'Play', 'Record') },
  91: { name: 'Pedal', values: halves('Bypassed', 'Engaged') },
  92: {
    name: 'Dual Bypass',
    values: [
      [31, 'Total Bypass'],
      [63, 'Dual Bypass'],
      [127, 'Total Engage'],
    ],
  },
  93: { name: 'Tap' },
  94: {
    name: 'Calibration Level',
    values: [
      [31, 'Low'],
      [63, 'Medium'],
      [95, 'High'],
      [127, 'Very High'],
    ],
  },
  95: { name: 'Calibration menu', values: halves('Exit', 'Enter') },
};

/**
 * What a CC and value do on the pedal, e.g. "Character → Howl" for CC 16 = 76, "Character → Bypassed" for CC 103 = 0,
 * "Filter style → Lowpass" for CC 84 = 21 or "Character → Amount" for a level; undefined for a CC not in the MIDI
 * implementation chart.
 */
export function describeCc(cc: number, value: number): string | undefined {
  const param = paramByCc(cc);
  if (param) {
    const setting = settingLabel(param, value) ?? param.label;
    if (param.group === 'fxSetup') return `${param.label} → ${setting}`;
    return param.module ? `${MODULES[param.module]} → ${setting}` : setting;
  }
  const entry = MIDI_CHART[cc];
  if (!entry) return undefined;
  const band = entry.values?.find(([max]) => value <= max);
  return band ? `${entry.name} → ${band[1]}` : entry.name;
}
