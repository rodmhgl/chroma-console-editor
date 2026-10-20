import { DEFAULT_MIDI_CHANNEL, PARAMS, PEDAL_STEP_PARAMS, clampToParam, slotAddress, type PedalStepParamId } from '../midi/map';
import type { RestoredSession, Snapshot } from '../model/core';
import { isObject, readWorkingState } from '../model/schema';
import type { SlotMap } from '../model/slotMap';
import { MIDI_CHANNELS } from '../ui/midiChannels';
import { DEFAULT_SEND_GAP_MS, SEND_GAP_RANGE } from './editorStore';
import type { WorkingSource } from './library';
import { DEFAULT_UI_SETTINGS, UI_SCALE_RANGE, isTheme, type UiSettings } from './settingsStore';

// What the editor keeps between sessions (SPEC.md story 86), and how it reads it back: anything stored may be from an
// older build or damaged, so every field is checked and falls back to its default.

/** Bump when a stored session can no longer be read as this one; an older session is then ignored. */
export const SESSION_VERSION = 1;

/** The editor's Settings: none of them is sent to the pedal. */
export type Settings = UiSettings & { sendGapMs: number };

export type Session = RestoredSession & {
  version: typeof SESSION_VERSION;
  /** Null for a Working State with no Preset that was never saved: it restores as Untitled. */
  source: WorkingSource | null;
  settings: Settings;
};

const isString = (v: unknown): v is string => typeof v === 'string';

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, value));

/** A stored session, checked field by field; null if it isn't one this version can read. */
export function parseSession(raw: unknown): Session | null {
  if (!isObject(raw) || raw.version !== SESSION_VERSION) return null;
  const { midiChannel } = raw;
  return {
    version: SESSION_VERSION,
    working: readWorkingState(raw.working),
    snapshot: readSnapshot(raw.snapshot),
    slotMap: readSlotMap(raw.slotMap),
    confirmed: readConfirmed(raw.confirmed),
    midiChannel: isNumber(midiChannel) && MIDI_CHANNELS.includes(midiChannel) ? midiChannel : DEFAULT_MIDI_CHANNEL,
    source: readSource(raw.source),
    settings: readSettings(raw.settings),
  };
}

function readSnapshot(raw: unknown): Snapshot | null {
  if (!isObject(raw) || !isObject(raw.state)) return null;
  return { state: readWorkingState(raw.state), showing: raw.showing === true };
}

function readSlotMap(raw: unknown): SlotMap {
  const slotMap: SlotMap = {};
  if (!isObject(raw)) return slotMap;
  for (const [key, entry] of Object.entries(raw)) {
    const slot = Number(key);
    if (!Number.isInteger(slot) || !slotAddress(slot) || !isObject(entry) || !isObject(entry.committed) || !isString(entry.name)) continue;
    slotMap[slot] = {
      committed: readWorkingState(entry.committed),
      presetId: isString(entry.presetId) ? entry.presetId : null,
      name: entry.name,
    };
  }
  return slotMap;
}

/** A Pedal Step setting never confirmed is assumed to be its default, as in a new Editor State. */
function readConfirmed(raw: unknown): Record<PedalStepParamId, number> {
  const stored = isObject(raw) ? raw : {};
  return Object.fromEntries(
    PEDAL_STEP_PARAMS.map((id) => {
      const value = stored[id];
      return [id, isNumber(value) ? clampToParam(PARAMS[id], value) : PARAMS[id].default];
    }),
  ) as Record<PedalStepParamId, number>;
}

function readSource(raw: unknown): WorkingSource | null {
  if (!isObject(raw) || !isString(raw.name) || !isObject(raw.params)) return null;
  return { presetId: isString(raw.presetId) ? raw.presetId : null, name: raw.name, params: readWorkingState(raw.params) };
}

function readSettings(raw: unknown): Settings {
  const stored = isObject(raw) ? raw : {};
  const { uiScale, sendGapMs } = stored;
  return {
    theme: isTheme(stored.theme) ? stored.theme : DEFAULT_UI_SETTINGS.theme,
    uiScale: isNumber(uiScale) ? Math.round(clamp(uiScale, UI_SCALE_RANGE)) : DEFAULT_UI_SETTINGS.uiScale,
    sendGapMs: isNumber(sendGapMs) ? Math.round(clamp(sendGapMs, SEND_GAP_RANGE)) : DEFAULT_SEND_GAP_MS,
  };
}
