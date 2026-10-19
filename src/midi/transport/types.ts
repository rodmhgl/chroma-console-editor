import type { MidiMessage } from '../encode';

export type MidiPort = { id: string; name: string };

/** Everything the editor needs from a MIDI backend (Web MIDI, Virtual Pedal). The pedal never sends MIDI, so no inputs. */
export interface MidiTransport {
  listOutputs(): MidiPort[];
  send(bytes: MidiMessage): void;
}
