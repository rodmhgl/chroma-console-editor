import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';
import { createVirtualPedal } from '../midi/transport/virtual';
import { syncStatus } from '../model/core';
import { defaultWorkingState } from '../model/state';
import { createEditorStore } from './editorStore';
import type { WorkingSource } from './library';
import { keepSession, startSession, type SessionStorage } from './persistence';
import { SESSION_VERSION, parseSession, type Session } from './session';
import { createSettingsStore } from './settingsStore';

let stores: {
  editor: ReturnType<typeof createEditorStore>;
  library: ReturnType<typeof createSourceStore>;
  settings: ReturnType<typeof createSettingsStore>;
};

/** The one part of the Library store a session holds. */
function createSourceStore() {
  return create<{ source: WorkingSource }>(() => ({
    source: { presetId: null, name: 'Untitled', params: defaultWorkingState() },
  }));
}

/** Storage in memory; each `save` waits until `flush` while `held`. */
function memoryStorage(initial?: unknown) {
  const saved: Session[] = [];
  let held = false;
  let release: (() => void)[] = [];
  const storage: SessionStorage = {
    load: async () => initial,
    async save(session) {
      if (held) await new Promise<void>((resolve) => release.push(resolve));
      saved.push(session);
    },
  };
  return {
    storage,
    saved,
    hold: () => (held = true),
    flush: async () => {
      held = false;
      release.forEach((r) => r());
      release = [];
      await vi.runAllTimersAsync();
    },
  };
}

const working = { ...defaultWorkingState(), tilt: 20, moduleOrder: 3 };
const session: Session = {
  version: SESSION_VERSION,
  working,
  snapshot: { state: { ...working, mix: 40 }, showing: false },
  slotMap: { 12: { committed: working, presetId: 'p-1', name: 'Shimmer' } },
  confirmed: { moduleOrder: 3 },
  midiChannel: 9,
  source: { presetId: 'p-1', name: 'Shimmer', params: defaultWorkingState() },
  settings: { theme: 'charcoal', uiScale: 150, sendGapMs: 12 },
};

beforeEach(() => {
  vi.useFakeTimers();
  stores = { editor: createEditorStore(createVirtualPedal()), library: createSourceStore(), settings: createSettingsStore() };
});
afterEach(() => vi.useRealTimers());

describe('startSession', () => {
  it('restores the last session into the editor, Library and Settings, Possibly Stale and sending nothing', async () => {
    await startSession(memoryStorage(session).storage, stores);

    const { editor, sendGapMs, sent } = stores.editor.getState();
    expect(editor).toMatchObject({
      working,
      snapshot: session.snapshot,
      slotMap: session.slotMap,
      confirmed: session.confirmed,
      global: { midiChannel: 9 },
    });
    expect(syncStatus(editor)).toBe('possiblyStale');
    expect(sendGapMs).toBe(12);
    expect(sent).toEqual([]);
    expect(stores.library.getState().source).toEqual(session.source);
    expect(stores.settings.getState()).toMatchObject({ theme: 'charcoal', uiScale: 150 });
  });

  it('restores a Working State with no source as Untitled and unmodified', async () => {
    await startSession(memoryStorage({ ...session, source: null }).storage, stores);

    expect(stores.library.getState().source).toEqual({ presetId: null, name: 'Untitled', params: working });
  });

  it('starts from defaults when nothing usable was stored, or storage fails', async () => {
    const before = stores.editor.getState().editor;
    await startSession(memoryStorage('junk').storage, stores);
    await startSession({ load: () => Promise.reject(new Error('blocked')), save: async () => {} }, stores);

    expect(stores.editor.getState().editor).toBe(before);
  });

  it('goes on saving changes after restoring', async () => {
    const memory = memoryStorage(session);
    await startSession(memory.storage, stores);

    stores.editor.getState().setParam('tilt', 3);
    await vi.runAllTimersAsync();

    expect(memory.saved.at(-1)?.working.tilt).toBe(3);
  });
});

describe('keepSession', () => {
  it('saves every kept part as it changes, in a form parseSession reads back', async () => {
    const memory = memoryStorage();
    keepSession(memory.storage, stores);

    const editor = stores.editor.getState();
    editor.setParam('tilt', 42);
    editor.takeSnapshot();
    editor.setModuleOrder(['texture', 'movement', 'diffusion', 'character']);
    editor.confirmPedalStep('moduleOrder');
    editor.setMidiChannel(9);
    editor.setSendGapMs(12);
    stores.settings.getState().update({ uiScale: 120 });
    stores.library.setState({ source: { presetId: 'p-2', name: 'Drone', params: working } });
    await vi.runAllTimersAsync();

    const last = memory.saved.at(-1)!;
    expect(parseSession(JSON.parse(JSON.stringify(last)))).toEqual(last);
    const { moduleOrder } = stores.editor.getState().editor.working;
    expect(last).toMatchObject({
      working: { tilt: 42, moduleOrder },
      snapshot: { state: { tilt: 42 }, showing: false },
      confirmed: { moduleOrder },
      midiChannel: 9,
      source: { presetId: 'p-2', name: 'Drone' },
      settings: { uiScale: 120, sendGapMs: 12 },
    });
  });

  it('writes nothing for changes it doesn’t keep, like the MIDI Monitor or a Performance Control', async () => {
    const memory = memoryStorage();
    keepSession(memory.storage, stores);

    stores.editor.getState().perform('capture', 'record');
    stores.editor.getState().beginDrag();
    await vi.runAllTimersAsync();

    expect(memory.saved).toEqual([]);
  });

  it('writes one save at a time, then only the latest of any changes made meanwhile', async () => {
    const memory = memoryStorage();
    keepSession(memory.storage, stores);
    memory.hold();

    for (const tilt of [1, 2, 3, 4]) stores.editor.getState().setParam('tilt', tilt);
    await memory.flush();

    expect(memory.saved.map((s) => s.working.tilt)).toEqual([1, 4]);
  });

  it('keeps going after a save fails', async () => {
    const saved: number[] = [];
    let fail = true;
    keepSession(
      {
        load: async () => undefined,
        async save(s) {
          if (fail) throw new Error('quota');
          saved.push(s.working.tilt);
        },
      },
      stores,
    );

    stores.editor.getState().setParam('tilt', 1);
    await vi.runAllTimersAsync();
    fail = false;
    stores.editor.getState().setParam('tilt', 2);
    await vi.runAllTimersAsync();

    expect(saved).toEqual([2]);
  });
});
