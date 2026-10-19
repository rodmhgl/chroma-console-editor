import { decode } from '../decode';
import type { MidiMessage } from '../encode';
import { DEFAULT_MIDI_CHANNEL } from '../map';
import type { MidiPort, MidiTransport } from './types';

export const VIRTUAL_PEDAL_PORT: MidiPort = { id: 'virtual-pedal', name: 'Virtual Pedal' };

export type LogEntry = { id: number; text: string };

export type VirtualPedalState = { midiChannel: number; log: LogEntry[] };

export interface VirtualPedal extends MidiTransport {
  /** The current state, replaced on every change (for `useSyncExternalStore`). */
  getSnapshot(): VirtualPedalState;
  subscribe(cb: () => void): () => void;
}

/** A simulated pedal that logs every message it is sent. It decodes nothing yet: the pedal map comes next. */
export function createVirtualPedal(midiChannel = DEFAULT_MIDI_CHANNEL): VirtualPedal {
  let state: VirtualPedalState = { midiChannel, log: [] };
  let nextLogId = 1;
  const listeners = new Set<() => void>();

  function receive(bytes: MidiMessage) {
    const msg = decode(bytes);
    let text: string;
    if (msg.kind === 'unknown') text = `Unknown: ${bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`;
    else {
      const what = msg.kind === 'cc' ? `CC ${msg.cc} = ${msg.value}` : `PC ${msg.program}`;
      text =
        msg.midiChannel === state.midiChannel
          ? `${what} → (not in MIDI map)`
          : `${what} on MIDI channel ${msg.midiChannel} → ignored (pedal listens on MIDI channel ${state.midiChannel})`;
    }
    state = { ...state, log: [...state.log, { id: nextLogId++, text }] };
    listeners.forEach((l) => l());
  }

  return {
    listOutputs: () => [VIRTUAL_PEDAL_PORT],
    send: receive,
    getSnapshot: () => state,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
