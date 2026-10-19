export type MidiMessage = number[];

/** Control Change on a 1-based MIDI channel (1–16). */
export function controlChange(midiChannel: number, cc: number, value: number): MidiMessage {
  return [0xb0 | (midiChannel - 1), cc, value];
}

/** Program Change on a 1-based MIDI channel (1–16). */
export function programChange(midiChannel: number, program: number): MidiMessage {
  return [0xc0 | (midiChannel - 1), program];
}
