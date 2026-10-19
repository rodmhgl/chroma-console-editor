import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIRTUAL_PEDAL_PORT, createVirtualPedal } from '../midi/transport/virtual';
import { encodeSendAll } from '../model/core';
import { canRedo, canUndo } from '../model/history';
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
  const store = createEditorStore(createVirtualPedal());
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
    const store = createEditorStore(createVirtualPedal());
    expect(store.getState().editor.global.midiChannel).toBe(1);

    store.getState().setMidiChannel(16);

    expect(store.getState().editor.global.midiChannel).toBe(16);
  });
});

describe('editor store sending', () => {
  afterEach(() => vi.useRealTimers());

  const sentTo = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

  it('sends an Effect choice to the selected output at once', () => {
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    store.getState().selectEffect('characterEffect', 'howl');

    expect(store.getState().editor.working.characterEffect).toBe(76);
    expect(sentTo(pedal)).toEqual(['CC 16 = 76 → Character → Howl']);
  });

  it('sends Engaged/Bypassed and a choice such as Filter style at once, never throttled', () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    store.getState().setEngaged('texture', false);
    store.getState().setEngaged('texture', true);
    store.getState().selectChoice('filterStyle', 'lowpass');
    store.getState().selectChoice('captureRouting', 'preFx');

    expect(sentTo(pedal)).toEqual([
      'CC 106 = 0 → Texture → Bypassed',
      'CC 106 = 127 → Texture → Engaged',
      'CC 84 = 21 → Filter style → Lowpass',
      'CC 83 = 127 → Capture Routing → Pre-FX',
    ]);
  });

  it('sends Performance Controls and Calibration Level at once, every tap heard, with the Working State untouched', () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    const working = store.getState().editor.working;

    store.getState().perform('tap', 'tap');
    store.getState().perform('tap', 'tap');
    store.getState().perform('dualBypass', 'totalBypass');
    store.getState().setCalibrationLevel('veryHigh');

    expect(sentTo(pedal)).toEqual([
      'CC 93 = 127 → Tap',
      'CC 93 = 127 → Tap',
      'CC 92 = 15 → Dual Bypass → Total Bypass',
      'CC 94 = 111 → Calibration Level → Very High',
    ]);
    expect(store.getState().editor.working).toBe(working);
    expect(store.getState().editor.global.calibrationLevel).toBe('veryHigh');
  });

  it('throttles a drag per parameter, always sending the latest value last', () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    for (const value of [70, 71, 72]) store.getState().setParam('characterAmount', value);
    store.getState().setParam('tilt', 30);
    expect(sentTo(pedal)).toEqual(['CC 65 = 70 → Character → Amount', 'CC 64 = 30 → Character → Tilt']);

    vi.runAllTimers();
    expect(sentTo(pedal).at(-1)).toBe('CC 65 = 72 → Character → Amount');
    expect(store.getState().editor.working.characterAmount).toBe(72);
  });

  it('sends to a Web MIDI output once it is selected', async () => {
    const usb = output('usb', PEDAL_NAME);
    fakeWebMidi([usb]);
    const store = await connectedStore();

    store.getState().selectEffect('characterEffect', 'fuzz');

    expect(usb.send).toHaveBeenCalledWith([0xb0, 16, 54]);
  });

  it('lists what it sends in the MIDI Monitor once it has gone out, the throttled drag as one row', () => {
    vi.useFakeTimers();
    const store = createEditorStore(createVirtualPedal());

    store.getState().selectEffect('characterEffect', 'howl');
    for (const value of [70, 71, 72]) store.getState().setParam('characterAmount', value);
    vi.runAllTimers();

    expect(store.getState().sent.map((m) => m.bytes)).toEqual([
      [0xb0, 65, 72],
      [0xb0, 16, 76],
    ]);
  });
});

describe('editor store Raw MIDI', () => {
  const heardBy = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

  it('sends every message unchanged and at once, however fast, and lists each in the MIDI Monitor', () => {
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    for (const value of [1, 2, 3]) store.getState().sendRaw([0xb0, 93, value]);
    store.getState().sendRaw([0xc0, 3]);

    expect(heardBy(pedal)).toEqual([
      'CC 93 = 1 → Tap',
      'CC 93 = 2 → Tap',
      'CC 93 = 3 → Tap',
      'PC 3 → Recall Slot A-4',
    ]);
    // Newest first, with the repeated CC folded into one row that shows its latest value.
    expect(store.getState().sent.map((m) => m.bytes)).toEqual([
      [0xc0, 3],
      [0xb0, 93, 3],
    ]);
  });

  it('sends to a Web MIDI output once it is selected, and not to the Virtual Pedal', async () => {
    const usb = output('usb', PEDAL_NAME);
    fakeWebMidi([usb]);
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    await store.getState().connectWebMidi();

    store.getState().sendRaw([0xb4, 16, 76]);

    expect(usb.send).toHaveBeenCalledWith([0xb4, 16, 76]);
    expect(heardBy(pedal)).toEqual([]);
    expect(store.getState().sent.map((m) => m.bytes)).toEqual([[0xb4, 16, 76]]);
  });

  it('clears the MIDI Monitor', () => {
    const store = createEditorStore(createVirtualPedal());
    store.getState().sendRaw([0xb0, 93, 1]);

    store.getState().clearSent();

    expect(store.getState().sent).toEqual([]);
  });

  it('makes the Sync Status Possibly Stale, since the message may have changed anything', async () => {
    const store = createEditorStore(createVirtualPedal());
    await store.getState().sendAll();

    store.getState().sendRaw([0xb0, 64, 0]);

    expect(store.getState().editor.sync).toBe('possiblyStale');
  });
});

describe('editor store Send All', () => {
  afterEach(() => vi.useRealTimers());

  const heardBy = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

  it('starts Possibly Stale, with the Virtual Pedal selected', () => {
    expect(createEditorStore(createVirtualPedal()).getState().editor.sync).toBe('possiblyStale');
  });

  it('sends every setting with the Send All gap between messages, then is In Sync', async () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    store.getState().setSendGapMs(10);
    store.getState().selectEffect('characterEffect', 'howl');

    const done = store.getState().sendAll();
    expect(store.getState().sendingAll).toBe(true);
    expect(heardBy(pedal)).toEqual(['CC 16 = 76 → Character → Howl', 'CC 16 = 76 → Character → Howl']);
    await vi.advanceTimersByTimeAsync(9);
    expect(heardBy(pedal)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(heardBy(pedal).at(-1)).toBe('CC 17 = 10 → Movement → Doubler');
    expect(store.getState().editor.sync).toBe('possiblyStale');

    await vi.runAllTimersAsync();
    expect(await done).toBe(true);
    expect(heardBy(pedal)).toHaveLength(27);
    expect(heardBy(pedal).at(-1)).toBe('CC 106 = 127 → Texture → Engaged');
    expect(store.getState().sendingAll).toBe(false);
    expect(store.getState().editor.sync).toBe('inSync');
  });

  it('sends exactly the editor core’s Send All bytes, in order', async () => {
    const usb = output('usb', PEDAL_NAME);
    fakeWebMidi([usb]);
    const store = await connectedStore();
    store.getState().setSendGapMs(0);
    store.getState().selectChoice('filterStyle', 'highpass');
    vi.mocked(usb.send).mockClear();

    await store.getState().sendAll();

    expect(vi.mocked(usb.send).mock.calls.map(([bytes]) => bytes)).toEqual(encodeSendAll(store.getState().editor));
  });

  it('sends a setting edited part-way at its new value', async () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    const done = store.getState().sendAll();
    store.getState().setEngaged('texture', false);
    await vi.runAllTimersAsync();
    await done;

    expect(heardBy(pedal).at(-1)).toBe('CC 106 = 0 → Texture → Bypassed');
  });

  it('is abandoned when the output changes part-way, leaving the Sync Status Possibly Stale', async () => {
    vi.useFakeTimers();
    fakeWebMidi([output('din', 'USB MIDI Interface')]);
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    await store.getState().connectWebMidi();

    const done = store.getState().sendAll();
    store.getState().setOutput('din');
    await vi.runAllTimersAsync();

    expect(await done).toBe(false);
    expect(heardBy(pedal)).toHaveLength(1);
    expect(store.getState().sendingAll).toBe(false);
    expect(store.getState().editor.sync).toBe('possiblyStale');
  });
});

describe('editor store Sync Status', () => {
  it('is Unknown when the selected output is unplugged, and Possibly Stale when it is back', async () => {
    const pedal = output('usb', PEDAL_NAME);
    const midi = fakeWebMidi([pedal]);
    const store = await connectedStore();
    await store.getState().sendAll();
    expect(store.getState().editor.sync).toBe('inSync');

    midi.unplug(pedal);
    expect(store.getState().editor.sync).toBe('unknown');

    pedal.state = 'connected';
    midi.plug(pedal);
    expect(store.getState().editor.sync).toBe('possiblyStale');
  });

  it('is Possibly Stale when another output is selected', async () => {
    const din = output('din', 'USB MIDI Interface');
    fakeWebMidi([din]);
    const store = await connectedStore();
    await store.getState().sendAll();

    store.getState().setOutput('din');
    expect(store.getState().editor.sync).toBe('possiblyStale');
  });

  it('is Possibly Stale after a send fails', async () => {
    const usb = output('usb', PEDAL_NAME);
    fakeWebMidi([usb]);
    const store = await connectedStore();
    await store.getState().sendAll();

    vi.mocked(usb.send).mockImplementation(() => {
      throw new Error('port closed');
    });
    store.getState().selectEffect('characterEffect', 'fuzz');

    expect(store.getState().editor.sync).toBe('possiblyStale');
    expect(store.getState().sent.map((m) => m.bytes)).not.toContainEqual([0xb0, 16, 54]);
  });

  it('stays Possibly Stale when a send fails during Send All, which stops there', async () => {
    const usb = output('usb', PEDAL_NAME);
    fakeWebMidi([usb]);
    const store = await connectedStore();
    vi.mocked(usb.send).mockImplementation(() => {
      throw new Error('port closed');
    });

    expect(await store.getState().sendAll()).toBe(false);
    expect(usb.send).toHaveBeenCalledTimes(1);
    expect(store.getState().editor.sync).toBe('possiblyStale');
  });
});

describe('editor store undo/redo', () => {
  afterEach(() => vi.useRealTimers());

  it('undoes and redoes Working State edits, sending each result to the pedal', () => {
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    expect(canUndo(store.getState().editor.history)).toBe(false);

    store.getState().selectEffect('characterEffect', 'howl');
    store.getState().setEngaged('texture', false);
    expect(canUndo(store.getState().editor.history)).toBe(true);

    store.getState().undo();
    store.getState().undo();
    expect(pedal.getSnapshot().state).toMatchObject({ characterEffect: 10, textureEngaged: 127 });
    expect(store.getState().editor.working).toMatchObject({ characterEffect: 10, textureEngaged: 127 });
    expect(canUndo(store.getState().editor.history)).toBe(false);
    expect(canRedo(store.getState().editor.history)).toBe(true);

    store.getState().redo();
    store.getState().redo();
    expect(pedal.getSnapshot().state).toMatchObject({ characterEffect: 76, textureEngaged: 0 });
    expect(canRedo(store.getState().editor.history)).toBe(false);
  });

  it('undoes a knob drag as one step, after its last throttled value has gone out', () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    store.getState().beginDrag();
    for (let v = 65; v <= 100; v++) store.getState().setParam('characterAmount', v);
    store.getState().endDrag();
    store.getState().undo();
    vi.runAllTimers();

    expect(store.getState().editor.working.characterAmount).toBe(64);
    expect(pedal.getSnapshot().state.characterAmount).toBe(64);
    expect(canUndo(store.getState().editor.history)).toBe(false);
  });

  it('sends nothing with nothing to undo or redo, and never undoes the MIDI channel or Raw MIDI', () => {
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);
    store.getState().setMidiChannel(3);
    store.getState().sendRaw([0xb0, 64, 10]);

    store.getState().undo();
    store.getState().redo();

    expect(pedal.getSnapshot().log.map((e) => e.text)).toEqual(['CC 64 = 10 → Character → Tilt']);
    expect(store.getState().editor.global.midiChannel).toBe(3);
  });
});

describe('editor store Slot recall', () => {
  afterEach(() => vi.useRealTimers());

  const heardBy = (pedal: ReturnType<typeof createVirtualPedal>) => pedal.getSnapshot().log.map((e) => e.text);

  it('sends the Slot’s Program Change; an unknown Slot makes the Sync Status Unknown', () => {
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    expect(store.getState().recallSlot(33)).toBe(true);

    expect(heardBy(pedal)).toEqual(['PC 33 → Recall Slot B-14']);
    expect(store.getState().editor.sync).toBe('unknown');
  });

  it('sends nothing and changes nothing with no output connected', async () => {
    const pedal = output('usb', PEDAL_NAME);
    const midi = fakeWebMidi([pedal]);
    const store = await connectedStore();
    midi.unplug(pedal);
    vi.mocked(pedal.send).mockClear();
    const before = store.getState().editor;

    expect(store.getState().recallSlot(33)).toBe(false);

    expect(pedal.send).not.toHaveBeenCalled();
    expect(store.getState().editor).toBe(before);
  });

  it('abandons a Send All in progress, which would otherwise send the old Working State over the Slot', async () => {
    vi.useFakeTimers();
    const pedal = createVirtualPedal();
    const store = createEditorStore(pedal);

    const done = store.getState().sendAll();
    store.getState().recallSlot(0);
    await vi.runAllTimersAsync();

    expect(await done).toBe(false);
    expect(heardBy(pedal)).toEqual(['CC 16 = 10 → Character → Drive', 'PC 0 → Recall Slot A-1']);
    expect(store.getState().editor.sync).toBe('unknown');
  });
});
