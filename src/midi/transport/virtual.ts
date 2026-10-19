import { defaultPedalState, type PedalState } from '../../model/state';
import { decode } from '../decode';
import type { MidiMessage } from '../encode';
import { DEFAULT_MIDI_CHANNEL, MODULES, paramByCc, settingLabel, type ParamDef, type PresetParamId } from '../map';
import type { MidiPort, MidiTransport } from './types';

export const VIRTUAL_PEDAL_PORT: MidiPort = { id: 'virtual-pedal', name: 'Virtual Pedal' };

export type LogEntry = { id: number; text: string };

export type VirtualPedalSnapshot = { state: PedalState; midiChannel: number; log: LogEntry[] };

export interface VirtualPedal extends MidiTransport {
  /** The current state, replaced on every change (for `useSyncExternalStore`). */
  getSnapshot(): VirtualPedalSnapshot;
  subscribe(cb: () => void): () => void;
}

/** What a value sets a control to, e.g. "Character → Howl" for an Effect selection or "Character → Amount" for a level. */
function describe(param: ParamDef, value: number): string {
  return `${MODULES[param.module]} → ${settingLabel(param, value) ?? param.label}`;
}

/** A simulated pedal that decodes every message it is sent through the pedal map. */
export function createVirtualPedal(midiChannel = DEFAULT_MIDI_CHANNEL): VirtualPedal {
  let snapshot: VirtualPedalSnapshot = { state: defaultPedalState(), midiChannel, log: [] };
  let nextLogId = 1;
  const listeners = new Set<() => void>();

  function receive(bytes: MidiMessage) {
    const msg = decode(bytes);
    let text: string;
    let pedalState = snapshot.state;
    if (msg.kind === 'unknown') text = `Unknown: ${bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`;
    else {
      const what = msg.kind === 'cc' ? `CC ${msg.cc} = ${msg.value}` : `PC ${msg.program}`;
      const param = msg.kind === 'cc' ? paramByCc(msg.cc) : undefined;
      if (msg.midiChannel !== snapshot.midiChannel)
        text = `${what} on MIDI channel ${msg.midiChannel} → ignored (pedal listens on MIDI channel ${snapshot.midiChannel})`;
      else if (msg.kind === 'cc' && param) {
        pedalState = { ...pedalState, [param.id as PresetParamId]: msg.value };
        text = `${what} → ${describe(param, msg.value)}`;
      } else text = `${what} → (not in MIDI map)`;
    }
    snapshot = { ...snapshot, state: pedalState, log: [...snapshot.log, { id: nextLogId++, text }] };
    listeners.forEach((l) => l());
  }

  return {
    listOutputs: () => [VIRTUAL_PEDAL_PORT],
    send: receive,
    getSnapshot: () => snapshot,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
