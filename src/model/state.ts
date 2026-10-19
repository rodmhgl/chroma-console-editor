import { DEFAULT_MIDI_CHANNEL, PRESET_PARAMS, type CalibrationLevelId, type PresetParamId } from '../midi/map';

/** The single pedal state the editor edits and sends: raw values keyed by parameter id. */
export type WorkingState = Record<PresetParamId, number>;

/**
 * Pedal settings that are not part of a Preset. The pedal can't report its Calibration Level, so it is null until set
 * from the editor.
 */
export type GlobalSettings = { midiChannel: number; calibrationLevel: CalibrationLevelId | null };

export function defaultWorkingState(): WorkingState {
  return Object.fromEntries(PRESET_PARAMS.map((p) => [p.id, p.default])) as WorkingState;
}

export function defaultGlobalSettings(): GlobalSettings {
  return { midiChannel: DEFAULT_MIDI_CHANNEL, calibrationLevel: null };
}

/** What the Virtual Pedal is sounding: the Preset settings. Performance Controls and Calibration Level are only logged. */
export type PedalState = WorkingState;

export const defaultPedalState = defaultWorkingState;
