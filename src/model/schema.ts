import { PRESET_PARAMS, clampToParam, type PresetParamId } from '../midi/map';
import type { WorkingState } from './state';

// The Preset file format (ADR 0002, SPEC.md): Clean's envelope, with tags, and a flat map of raw preset-scoped params.

export const PRESET_FORMAT = 'chroma-console-preset';

/** Preset files end in this; only the `format` inside decides what a file is. */
export const PRESET_EXTENSION = '.ccpreset.json';

/** Another pedal's file is refused, never loaded best-effort: it would come out an all-defaults Preset (ADR 0002). */
const OTHER_PEDALS: Record<string, string> = {
  'clean-preset': 'This is a Clean Preset, open it in the Clean editor',
  'clean-bundle': 'This is a Clean Bundle, open it in the Clean editor',
  'lost-found-preset': 'This is a Lost+Found Preset, open it in the Lost+Found editor',
  'lost-found-bundle': 'This is a Lost+Found Bundle, open it in the Lost+Found editor',
};

/** Why a file object belongs to another pedal, or null if it doesn't seem to. */
function otherPedalError(file: unknown): string | null {
  if (!isObject(file) || typeof file.format !== 'string' || !Object.hasOwn(OTHER_PEDALS, file.format)) return null;
  return OTHER_PEDALS[file.format]!;
}

/** Bump with a migration whenever a preset param is added, a param ID is renamed or what a value means changes (ADR 0002). */
export const SCHEMA_VERSION = 1;

export type Preset = {
  /** The Preset's identity: survives Rename; New, Save As and Duplicate make a new one. */
  id: string;
  name: string;
  notes: string;
  /** Short labels for finding the Preset, each once whatever its case. */
  tags: string[];
  createdAt: string;
  modifiedAt: string;
  params: WorkingState;
};

export type ParseResult = { ok: true; preset: Preset; warnings: string[] } | { ok: false; error: string };

/** 2-space JSON, envelope first, params in `PARAMS` order, trailing newline: an unchanged Preset writes an identical file. */
export function serializePreset(preset: Preset): string {
  return `${JSON.stringify(presetFile(preset), null, 2)}\n`;
}

/** A Preset as the object its file holds. */
function presetFile(preset: Preset) {
  return {
    format: PRESET_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: __APP_VERSION__,
    id: preset.id,
    name: preset.name,
    notes: preset.notes,
    tags: preset.tags,
    createdAt: preset.createdAt,
    modifiedAt: preset.modifiedAt,
    params: Object.fromEntries(PRESET_PARAMS.map((p) => [p.id, preset.params[p.id as PresetParamId]])),
  };
}

/** A Preset name is trimmed, non-empty and at most this long; it need not be unique. */
export const MAX_NAME_LENGTH = 64;

/** The name as stored, or null if it is blank. */
export function presetName(input: string): string | null {
  const name = input.trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || null;
}

/** A tag is trimmed, non-empty and at most this long. */
export const MAX_TAG_LENGTH = 32;

/** Tags as stored, from a list or a comma-separated line: blanks dropped, each tag once whatever its case. */
export function presetTags(input: string | readonly unknown[]): string[] {
  const tags: string[] = [];
  for (const raw of typeof input === 'string' ? input.split(',') : input) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH).trim();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) tags.push(tag);
  }
  return tags;
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a Preset file. `format` decides what a file is; the extension is ignored. Newer schema versions are
 * refused, so an older editor can't silently drop fields on save (ADR 0002).
 */
export function parsePreset(text: string): ParseResult {
  const file = parseJson(text);
  return file === undefined ? { ok: false, error: 'Not a Preset file' } : readPreset(file);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Why a file's `schemaVersion` can't be read, or null if it can. */
function schemaVersionError(schemaVersion: unknown): string | null {
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return 'Missing schemaVersion';
  }
  if (schemaVersion > SCHEMA_VERSION) return 'Made by a newer version of the editor, please update';
  return null;
}

/** A Preset from its file object. */
function readPreset(file: unknown): ParseResult {
  const otherPedal = otherPedalError(file);
  if (otherPedal) return { ok: false, error: otherPedal };
  if (!isObject(file) || file.format !== PRESET_FORMAT) return { ok: false, error: 'Not a Preset file' };
  if (typeof file.id !== 'string' || !file.id) return { ok: false, error: 'Missing id' };
  const name = typeof file.name === 'string' ? presetName(file.name) : null;
  if (!name) return { ok: false, error: 'Missing name' };
  const versionError = schemaVersionError(file.schemaVersion);
  if (versionError) return { ok: false, error: versionError };
  const warnings: string[] = [];
  if ((file.name as string).trim().length > MAX_NAME_LENGTH) {
    warnings.push(`Name longer than ${MAX_NAME_LENGTH} characters: shortened`);
  }
  const rawTags = Array.isArray(file.tags) ? file.tags : [];
  const tags = presetTags(rawTags);
  if (tags.length !== rawTags.length || tags.some((t, i) => t !== rawTags[i])) warnings.push('Tags tidied');
  const params = readParams(migrateParams(isObject(file.params) ? file.params : {}, file.schemaVersion as number), warnings);
  const date = (v: unknown) => (typeof v === 'string' ? v : new Date(0).toISOString());
  return {
    ok: true,
    preset: {
      id: file.id,
      name,
      notes: typeof file.notes === 'string' ? file.notes : '',
      tags,
      createdAt: date(file.createdAt),
      modifiedAt: date(file.modifiedAt),
      params,
    },
    warnings,
  };
}

/**
 * Each step brings a file's params from one `schemaVersion` to the next (ADR 0002): step i upgrades version i + 1.
 * A param a step adds takes its map default without a warning: the file isn't missing it.
 */
const MIGRATIONS: ((params: Record<string, unknown>) => Record<string, unknown>)[] = [];

/** A file's params brought up to `SCHEMA_VERSION`, one step at a time. */
function migrateParams(params: Record<string, unknown>, schemaVersion: number): Record<string, unknown> {
  return MIGRATIONS.slice(schemaVersion - 1).reduce((migrated, step) => step(migrated), params);
}

/**
 * Missing params take map defaults, unknown params are dropped, and values are clamped as the pedal decodes them:
 * an Effect selection or choice snaps to the value the editor sends for it. Every change is reported.
 */
function readParams(raw: Record<string, unknown>, warnings: string[]): WorkingState {
  const params = {} as WorkingState;
  for (const p of PRESET_PARAMS) {
    const id = p.id as PresetParamId;
    const value = raw[id];
    if (value === undefined) {
      params[id] = p.default;
      warnings.push(`${id} missing: set to ${p.default}`);
      continue;
    }
    params[id] = typeof value === 'number' && Number.isFinite(value) ? clampToParam(p, value) : p.default;
    if (params[id] !== value) warnings.push(`${id} ${JSON.stringify(value)}: set to ${params[id]}`);
  }
  const known = new Set<string>(PRESET_PARAMS.map((p) => p.id));
  for (const id of Object.keys(raw)) if (!known.has(id)) warnings.push(`Unknown param ${id} dropped`);
  return params;
}
