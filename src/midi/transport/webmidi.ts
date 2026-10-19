import type { MidiPort, MidiTransport } from './types';

/** A Web MIDI transport that sends to one selected output. */
export interface WebMidi extends MidiTransport {
  /** Which output `send` goes to; null sends nowhere. */
  selectOutput(id: string | null): void;
  isConnected(id: string): boolean;
  /** Fires when a port is plugged in, unplugged, opened or closed. Returns an unsubscribe function. */
  onPortsChange(cb: () => void): () => void;
}

function toPort(port: MIDIPort): MidiPort {
  return { id: port.id, name: port.name ?? port.id };
}

/**
 * Asks the browser for MIDI access, without SysEx: the pedal has none, and asking for it brings a sterner permission
 * prompt. Resolves null when Web MIDI is missing or the user refuses it.
 */
export async function requestWebMidi(): Promise<WebMidi | null> {
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return null;
  try {
    return createWebMidi(await navigator.requestMIDIAccess({ sysex: false }));
  } catch {
    return null;
  }
}

export function createWebMidi(access: MIDIAccess): WebMidi {
  let selectedOutput: string | null = null;
  const portListeners = new Set<() => void>();

  access.onstatechange = () => portListeners.forEach((cb) => cb());

  return {
    listOutputs: () => [...access.outputs.values()].filter((p) => p.state === 'connected').map(toPort),
    send(bytes) {
      const output = selectedOutput ? access.outputs.get(selectedOutput) : undefined;
      if (output?.state === 'connected') output.send(bytes);
    },
    selectOutput(id) {
      selectedOutput = id;
    },
    isConnected: (id) => access.outputs.get(id)?.state === 'connected',
    onPortsChange(cb) {
      portListeners.add(cb);
      return () => portListeners.delete(cb);
    },
  };
}
