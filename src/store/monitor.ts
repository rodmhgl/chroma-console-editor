import { decode } from '../midi/decode';
import type { MidiMessage } from '../midi/encode';
import { describeCc, slotAddress } from '../midi/map';

/** The MIDI Monitor shows about this many of the newest outgoing messages. */
export const MONITOR_ROWS = 15;

export type SentMessage = { id: number; at: number; bytes: MidiMessage };

/** A CC repeated within this many ms of the newest row is taken as the same drag. */
const DRAG_PACE_MS = 250;

/**
 * Adds an outgoing message, newest first. A CC repeating the newest row's CC at a drag's pace replaces it, so a knob
 * drag reads as one row that follows the knob; slower repeats, such as taps, each get a row.
 */
export function logSent(log: SentMessage[], message: SentMessage, max = MONITOR_ROWS): SentMessage[] {
  const [newest, ...rest] = log;
  const repeats = newest && message.at - newest.at < DRAG_PACE_MS && sameCc(newest.bytes, message.bytes);
  return [message, ...(repeats ? rest : log)].slice(0, max);
}

const sameCc = (a: MidiMessage, b: MidiMessage) => {
  const [x, y] = [decode(a), decode(b)];
  return x.kind === 'cc' && y.kind === 'cc' && x.midiChannel === y.midiChannel && x.cc === y.cc;
};

export type MonitorRow = { type: 'CC' | 'PC' | '—'; number: string; value: string; label: string };

/** A sent message as the monitor shows it: type, number, value and what it does on the pedal ('—' outside the chart). */
export function describeSent(bytes: MidiMessage): MonitorRow {
  const msg = decode(bytes);
  if (msg.kind === 'pc') {
    const slot = slotAddress(msg.program);
    return { type: 'PC', number: String(msg.program), value: '', label: slot ? `Recall Slot ${slot}` : 'No Slot' };
  }
  if (msg.kind === 'cc') {
    return { type: 'CC', number: String(msg.cc), value: String(msg.value), label: describeCc(msg.cc, msg.value) ?? '—' };
  }
  return { type: '—', number: '', value: '', label: msg.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') };
}
