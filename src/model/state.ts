import { DEFAULT_MIDI_CHANNEL, PARAMS, type PresetParamId } from '../midi/map';

/** The single pedal state the editor edits and sends: raw values keyed by parameter id. */
export type WorkingState = Record<PresetParamId, number>;

/** Pedal settings that are not part of a Preset. */
export type GlobalSettings = { midiChannel: number };

export function defaultWorkingState(): WorkingState {
  return Object.fromEntries(
    Object.values(PARAMS)
      .filter((p) => p.scope === 'preset')
      .map((p) => [p.id, p.default]),
  ) as WorkingState;
}

export function defaultGlobalSettings(): GlobalSettings {
  return { midiChannel: DEFAULT_MIDI_CHANNEL };
}

/** What the Virtual Pedal is sounding. Only Preset settings so far; Performance Controls will join them, as in Clean. */
export type PedalState = WorkingState;

export const defaultPedalState = defaultWorkingState;
