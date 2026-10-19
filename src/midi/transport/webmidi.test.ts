import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMidi, requestWebMidi } from './webmidi';

type FakePort = { id: string; name: string; type: 'output'; state: string; send: (b: number[]) => void };

function fakeAccess(outputs: FakePort[]) {
  const access = {
    outputs: new Map(outputs.map((p) => [p.id, p])),
    onstatechange: null as ((e: { port: FakePort }) => void) | null,
  };
  return access;
}

const output = (id: string, state = 'connected'): FakePort => ({ id, name: `${id} name`, type: 'output', state, send: vi.fn() });

describe('Web MIDI transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lists only connected outputs', () => {
    const access = fakeAccess([output('a'), output('b', 'disconnected')]);
    const midi = createWebMidi(access as unknown as MIDIAccess);

    expect(midi.listOutputs()).toEqual([{ id: 'a', name: 'a name' }]);
  });

  it('sends only to the selected, connected output', () => {
    const a = output('a');
    const b = output('b');
    const midi = createWebMidi(fakeAccess([a, b]) as unknown as MIDIAccess);

    midi.send([0xb1, 15, 1]);
    midi.selectOutput('b');
    midi.send([0xb1, 15, 2]);

    expect(a.send).not.toHaveBeenCalled();
    expect(b.send).toHaveBeenCalledExactlyOnceWith([0xb1, 15, 2]);
  });

  it('asks for MIDI access without SysEx', async () => {
    const requestMIDIAccess = vi.fn(async () => fakeAccess([]) as unknown as MIDIAccess);
    vi.stubGlobal('navigator', { requestMIDIAccess });

    expect(await requestWebMidi()).not.toBeNull();
    expect(requestMIDIAccess).toHaveBeenCalledExactlyOnceWith({ sysex: false });
  });

  it('is null when the browser has no Web MIDI', async () => {
    vi.stubGlobal('navigator', {});

    expect(await requestWebMidi()).toBeNull();
  });

  it('reports hot-plug changes and connection state', () => {
    const a = output('a');
    const access = fakeAccess([a]);
    const midi = createWebMidi(access as unknown as MIDIAccess);
    const changed = vi.fn();
    midi.onPortsChange(changed);

    a.state = 'disconnected';
    access.onstatechange!({ port: a });

    expect(changed).toHaveBeenCalledOnce();
    expect(midi.isConnected('a')).toBe(false);
    expect(midi.listOutputs()).toEqual([]);
  });
});
