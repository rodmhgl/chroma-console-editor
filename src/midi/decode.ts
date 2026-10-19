import type { MidiMessage } from './encode';

export type DecodedMessage =
  | { kind: 'cc'; midiChannel: number; cc: number; value: number }
  | { kind: 'pc'; midiChannel: number; program: number }
  | { kind: 'unknown'; bytes: MidiMessage };

export function decode(bytes: MidiMessage): DecodedMessage {
  const [status = 0, data1 = 0, data2 = 0] = bytes;
  const midiChannel = midiChannelOf(bytes)!;
  if ((status & 0xf0) === 0xb0 && bytes.length === 3) return { kind: 'cc', midiChannel, cc: data1, value: data2 };
  if ((status & 0xf0) === 0xc0 && bytes.length === 2) return { kind: 'pc', midiChannel, program: data1 };
  return { kind: 'unknown', bytes };
}

/** The MIDI channel (1–16) a message was sent on (notes, CC, PC, bends…); null for system messages, which have none. */
export function midiChannelOf(bytes: MidiMessage): number | null {
  const status = bytes[0] ?? 0;
  return status >= 0x80 && status < 0xf0 ? (status & 0x0f) + 1 : null;
}
