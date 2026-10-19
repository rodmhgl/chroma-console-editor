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
} as const;

export type ModuleId = keyof typeof MODULES;

/** One Effect a Module can host: the CC range that selects it, and its midpoint, which is what the editor sends. */
export type EffectDef = { id: string; label: string; min: number; max: number; value: number };

export type ParamDef = {
  id: string;
  label: string;
  cc: number;
  /** `continuous`: any of 0–127, sent as-is. `effect`: one of a Module's Effects, sent as the midpoint of its range. */
  kind: 'continuous' | 'effect';
  effects?: readonly EffectDef[];
  /** The Module the control drives: Tilt is Character's, as its red knob shows. */
  module: ModuleId;
  group: 'effect' | 'primary';
  scope: 'preset';
  min: number;
  max: number;
  default: number;
  /** A neutral centre the knob marks and snaps back to on double-click (e.g. Tilt's neutral EQ). */
  detent?: number;
  help: string;
  /** How the setting reaches the pedal; Pedal Step settings arrive with Module Order. */
  transport: 'cc';
};

/** Each Effect of a Module takes 22 values of its CC from 0, in order; 110–127 is OFF, which the editor never sends. */
const EFFECT_RANGE = 22;

const effect = <Id extends string>(id: Id, label: string, index: number) => {
  const min = index * EFFECT_RANGE;
  const max = min + EFFECT_RANGE - 1;
  return { id, label, min, max, value: Math.floor((min + max) / 2) } satisfies EffectDef;
};

const NEUTRAL = 64;

const primaryControl = <Id extends string>(id: Id, label: string, cc: number, module: ModuleId, defaultValue: number, help: string) =>
  ({ id, label, cc, kind: 'continuous', module, group: 'primary', scope: 'preset', min: 0, max: 127, default: defaultValue, help, transport: 'cc' }) as const;

const CHARACTER_EFFECTS = [
  effect('drive', 'Drive', 0),
  effect('sweeten', 'Sweeten', 1),
  effect('fuzz', 'Fuzz', 2),
  effect('howl', 'Howl', 3),
  effect('swell', 'Swell', 4),
] as const;

export const PARAMS = {
  characterEffect: {
    id: 'characterEffect',
    label: 'Effect',
    cc: 16,
    kind: 'effect',
    effects: CHARACTER_EFFECTS,
    module: 'character',
    group: 'effect',
    scope: 'preset',
    min: CHARACTER_EFFECTS[0].min,
    max: CHARACTER_EFFECTS.at(-1)!.max,
    default: CHARACTER_EFFECTS[0].value,
    help: 'Overdrive, compression, fuzz and swell effects: Drive, Sweeten, Fuzz, Howl or Swell.',
    transport: 'cc',
  },
  // The manual sets no neutral for Amount, so it starts at noon like Tilt.
  characterAmount: primaryControl('characterAmount', 'Amount', 65, 'character', NEUTRAL, 'How much of the Character Effect: drive, saturation or fuzz intensity, or Swell’s attack and decay times.'),
  tilt: {
    ...primaryControl('tilt', 'Tilt', 64, 'character', NEUTRAL, 'The tone of the Character Effect: neutral at centre, darker to the left, brighter to the right. Also shapes the saturation.'),
    detent: NEUTRAL,
  },
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

/** The Effect ids an Effect selection offers, e.g. 'howl'. */
export type EffectId<P extends EffectParamId = EffectParamId> = (typeof PARAMS)[P]['effects'][number]['id'];

const byCc = new Map<number, ParamDef>(Object.values(PARAMS).map((p) => [p.cc, p]));

export function paramByCc(cc: number): ParamDef | undefined {
  return byCc.get(cc);
}

/** The Effect a value of an Effect selection's CC selects, as the pedal reads it; undefined for OFF (110–127). */
export function effectAt(param: ParamDef, value: number): EffectDef | undefined {
  return param.effects?.find((e) => value >= e.min && value <= e.max);
}

/** What a control is set to, as the pedal names it: an Effect (or OFF for 110–127); undefined for a plain level. */
export function settingLabel(param: ParamDef, value: number): string | undefined {
  if (param.kind !== 'effect') return undefined;
  return effectAt(param, value)?.label ?? 'OFF';
}

/**
 * Rounds and clamps a value into the range the parameter accepts. An Effect selection snaps to the midpoint of the
 * Effect whose range holds it, and never into OFF.
 */
export function clampToParam(param: ParamDef, value: number): number {
  const v = Math.min(param.max, Math.max(param.min, Math.round(value)));
  return param.kind === 'effect' ? effectAt(param, v)!.value : v;
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

/** An Effect selection's bands; 110–127 is the chart's OFF, which is not the same as Bypassed. */
const effectBands = (...effects: [string, string, string, string, string]): ValueBands => [
  ...effects.map((label, i) => [(i + 1) * EFFECT_RANGE - 1, label] as const),
  [127, 'OFF'],
];
const halves = (low: string, high: string): ValueBands => [
  [63, low],
  [127, high],
];
const ENGAGED_BANDS = halves('Bypassed', 'Engaged');
const thirds = (low: string, middle: string, high: string): ValueBands => [
  [43, low],
  [87, middle],
  [127, high],
];

/**
 * The rest of the MIDI implementation chart: every CC not yet in PARAMS, for describing any message sent (the MIDI
 * Monitor). Tilt, Rate, Time and Mix belong to the Module whose column they sit in. A CC leaves here when it joins PARAMS.
 */
const MIDI_CHART: Record<number, ChartEntry> = {
  17:{ name: 'Movement', values: effectBands('Doubler', 'Vibrato', 'Phaser', 'Tremolo', 'Pitch') },
  18: { name: 'Diffusion', values: effectBands('Cascade', 'Reels', 'Space', 'Collage', 'Reverse') },
  19: { name: 'Texture', values: effectBands('Filter', 'Squash', 'Cassette', 'Broken', 'Interference') },
  66: { name: 'Movement → Rate' },
  67: { name: 'Movement → Amount' },
  68: { name: 'Diffusion → Time' },
  69: { name: 'Diffusion → Amount' },
  70: { name: 'Texture → Mix' },
  71: { name: 'Texture → Amount' },
  72: { name: 'Character → Sensitivity' },
  73: { name: 'Character → Effect Vol' },
  74: { name: 'Movement → Drift' },
  75: { name: 'Movement → Effect Vol' },
  76: { name: 'Diffusion → Drift' },
  77: { name: 'Diffusion → Effect Vol' },
  78: { name: 'Output Level' },
  79: { name: 'Texture → Effect Vol' },
  80: { name: 'Gesture', values: halves('Play', 'Record') },
  81: { name: 'Gesture → Stop/Erase' },
  82: { name: 'Capture', values: thirds('Stop/Clear', 'Play', 'Record') },
  83: { name: 'Capture Routing', values: halves('Post-FX', 'Pre-FX') },
  84: { name: 'Filter style', values: thirds('Lowpass', 'Tilt', 'Highpass') },
  91: { name: 'Pedal', values: ENGAGED_BANDS },
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
  103: { name: 'Character', values: ENGAGED_BANDS },
  104: { name: 'Movement', values: ENGAGED_BANDS },
  105: { name: 'Diffusion', values: ENGAGED_BANDS },
  106: { name: 'Texture', values: ENGAGED_BANDS },
};

/**
 * What a CC and value do on the pedal, e.g. "Character → Howl" for CC 16 = 76 or "Character → Amount" for a level;
 * undefined for a CC not in the MIDI implementation chart.
 */
export function describeCc(cc: number, value: number): string | undefined {
  const param = paramByCc(cc);
  if (param) return `${MODULES[param.module]} → ${settingLabel(param, value) ?? param.label}`;
  const entry = MIDI_CHART[cc];
  if (!entry) return undefined;
  const band = entry.values?.find(([max]) => value <= max);
  return band ? `${entry.name} → ${band[1]}` : entry.name;
}
