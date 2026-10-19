import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIRTUAL_PEDAL_PORT } from '../midi/transport/virtual';
import { createEditorStore } from './editorStore';

type FakeOutput = { id: string; name: string; type: 'output'; state: string; send: (b: number[]) => void };

const PEDAL_NAME = 'HOLOGRAM Chroma Console MIDI';
const output = (id: string, name: string): FakeOutput => ({ id, name, type: 'output', state: 'connected', send: vi.fn() });

/** Web MIDI with these outputs; `plug` and `unplug` hot-plug them as the browser would. */
function fakeWebMidi(outputs: FakeOutput[]) {
  const access = { outputs: new Map(outputs.map((p) => [p.id, p])), onstatechange: null as null | (() => void) };
  vi.stubGlobal('navigator', { requestMIDIAccess: async () => access });
  return {
    plug(port: FakeOutput) {
      access.outputs.set(port.id, port);
      access.onstatechange?.();
    },
    unplug(port: FakeOutput) {
      port.state = 'disconnected';
      access.onstatechange?.();
    },
  };
}

async function connectedStore() {
  const store = createEditorStore();
  await store.getState().connectWebMidi();
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('editor store connection', () => {
  it('lists the Virtual Pedal first, then the connected outputs', async () => {
    fakeWebMidi([output('din', 'USB MIDI Interface')]);
    const store = await connectedStore();

    expect(store.getState().outputs.map((p) => p.name)).toEqual(['Virtual Pedal', 'USB MIDI Interface']);
    expect(store.getState().webMidiStatus).toBe('available');
  });

  it('selects the pedal’s USB port when it is there at launch', async () => {
    fakeWebMidi([output('din', 'USB MIDI Interface'), output('usb', PEDAL_NAME)]);
    const store = await connectedStore();

    expect(store.getState().outputId).toBe('usb');
    expect(store.getState().isOutputConnected()).toBe(true);
  });

  it('refreshes the list on hot-plug, selecting the pedal when it is plugged in', async () => {
    const midi = fakeWebMidi([]);
    const store = await connectedStore();
    expect(store.getState().outputId).toBe(VIRTUAL_PEDAL_PORT.id);

    const pedal = output('usb', PEDAL_NAME);
    midi.plug(pedal);
    expect(store.getState().outputId).toBe('usb');

    midi.unplug(pedal);
    expect(store.getState().outputs).toEqual([VIRTUAL_PEDAL_PORT]);
    expect(store.getState().isOutputConnected()).toBe(false);
  });

  it('keeps the user’s choice of another output while the pedal stays plugged in', async () => {
    const midi = fakeWebMidi([output('usb', PEDAL_NAME)]);
    const store = await connectedStore();

    store.getState().setOutput(VIRTUAL_PEDAL_PORT.id);
    midi.plug(output('din', 'USB MIDI Interface'));

    expect(store.getState().outputId).toBe(VIRTUAL_PEDAL_PORT.id);
  });

  it('is unavailable without Web MIDI, leaving the Virtual Pedal', async () => {
    vi.stubGlobal('navigator', {});
    const store = await connectedStore();

    expect(store.getState().webMidiStatus).toBe('unavailable');
    expect(store.getState().outputs).toEqual([VIRTUAL_PEDAL_PORT]);
    expect(store.getState().isOutputConnected()).toBe(true);
  });
});

describe('editor store MIDI channel', () => {
  it('is 1 by default and can be set to any of 1–16', () => {
    const store = createEditorStore();
    expect(store.getState().midiChannel).toBe(1);

    store.getState().setMidiChannel(16);

    expect(store.getState().midiChannel).toBe(16);
  });
});
