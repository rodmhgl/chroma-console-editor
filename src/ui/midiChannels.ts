/** Every MIDI channel the pedal can listen on. */
export const MIDI_CHANNELS = Array.from({ length: 16 }, (_, i) => i + 1);

/** A MIDI channel as the UI prints it, e.g. "CH 02". */
export function midiChannelLabel(midiChannel: number): string {
  return `CH ${String(midiChannel).padStart(2, '0')}`;
}
