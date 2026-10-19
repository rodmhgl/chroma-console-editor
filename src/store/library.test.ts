import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVirtualPedal, type VirtualPedal } from '../midi/transport/virtual';
import { syncStatus } from '../model/core';
import { parsePreset, serializePreset, type Preset } from '../model/schema';
import { defaultWorkingState } from '../model/state';
import { createEditorStore } from './editorStore';
import { createLibraryStore, isModified, slotInfo, type LibraryDeps, type PickedFolder } from './library';

/**
 * A Library folder held in memory: file name → contents. `permission` is what the browser allows without asking,
 * and `answer` what the user says when asked.
 */
function memoryFolder(
  files: Record<string, string> = {},
  permission: PermissionState = 'granted',
  answer: PermissionState = permission,
) {
  const asked = { count: 0 };
  const folder: PickedFolder = {
    name: 'My Presets',
    queryPermission: async () => permission,
    requestPermission: async () => {
      asked.count++;
      permission = answer;
      return permission;
    },
    list: async () => Object.keys(files),
    read: async (fileName) => files[fileName]!,
    write: async (fileName, text) => {
      files[fileName] = text;
    },
    remove: async (fileName) => {
      delete files[fileName];
    },
  };
  return { folder, files, asked };
}

/** A folder deleted since it was picked. */
function goneFolder(): PickedFolder {
  const gone = async (): Promise<never> => {
    throw new DOMException('A requested file or directory could not be found', 'NotFoundError');
  };
  return { ...memoryFolder().folder, list: gone, read: gone };
}

function preset(name: string, params: Partial<Preset['params']> = {}, id = `id-${name}`): Preset {
  return {
    id,
    name,
    notes: '',
    tags: [],
    createdAt: '2026-10-01T10:00:00.000Z',
    modifiedAt: '2026-10-01T10:00:00.000Z',
    params: { ...defaultWorkingState(), ...params },
  };
}

/** The Preset stored in a file, as the editor would read it back. */
function presetIn(files: Record<string, string>, fileName: string): Preset {
  const result = parsePreset(files[fileName]!);
  if (!result.ok) throw new Error(result.error);
  return result.preset;
}

let virtualPedal: VirtualPedal;
let editor: ReturnType<typeof createEditorStore>;
let library: ReturnType<typeof createLibraryStore>;
let clock = 0;
let ids = 0;
/** The Library folder the editor remembers for the next launch. */
let remembered: PickedFolder | null;

function deps(folder: PickedFolder | null, browserFolder = memoryFolder().folder): LibraryDeps {
  return {
    pickFolder: async () => folder,
    openBrowserStorage: async () => browserFolder,
    now: () => new Date(clock++ * 60_000 + Date.UTC(2026, 9, 5)).toISOString(),
    newId: () => `new-${++ids}`,
    rememberedFolder: {
      load: async () => remembered,
      save: async (picked) => {
        remembered = picked;
      },
      clear: async () => {
        remembered = null;
      },
    },
  };
}

function setup(folder: PickedFolder) {
  library = createLibraryStore(editor, deps(folder));
  return library.getState().pickFolder();
}

/** What the editor shows for the Working State: its name, with "•" when modified. */
function workingLabel() {
  const { source } = library.getState();
  return `${source.name}${isModified(editor.getState().editor.working, source) ? ' •' : ''}`;
}

beforeEach(() => {
  virtualPedal = createVirtualPedal();
  editor = createEditorStore(virtualPedal);
  clock = 0;
  ids = 0;
  remembered = null;
});

describe('picking a Library folder', () => {
  it('lists its Presets by name and reports files it could not read', async () => {
    const { folder } = memoryFolder({
      'zed.ccpreset.json': serializePreset(preset('Zed')),
      'shimmer-tape.ccpreset.json': serializePreset(preset('Shimmer Tape')),
      'broken.ccpreset.json': '{ nope',
      'tape.cleanpreset.json': JSON.stringify({ format: 'clean-preset' }),
      'notes.txt': 'not json',
    });
    await setup(folder);

    const { folderName, presets, problems } = library.getState();
    expect(folderName).toBe('My Presets');
    expect(presets.map((p) => [p.preset.name, p.fileName])).toEqual([
      ['Shimmer Tape', 'shimmer-tape.ccpreset.json'],
      ['Zed', 'zed.ccpreset.json'],
    ]);
    expect(problems).toEqual([
      'broken.ccpreset.json: Not a Preset file',
      'tape.cleanpreset.json: This is a Clean Preset, open it in the Clean editor',
    ]);
  });

  it('clamps values on load and reports each one', async () => {
    const file = JSON.parse(serializePreset(preset('Zed')));
    file.params.characterEffect = 120;
    file.params.mix = 300;
    await setup(memoryFolder({ 'zed.ccpreset.json': JSON.stringify(file) }).folder);

    expect(library.getState().presets[0]!.preset.params).toMatchObject({ characterEffect: 98, mix: 127 });
    expect(library.getState().problems).toEqual([
      'zed.ccpreset.json: characterEffect 120: set to 98',
      'zed.ccpreset.json: mix 300: set to 127',
    ]);
  });

  it('keeps the first of two files with the same id', async () => {
    const { folder } = memoryFolder({
      'a.ccpreset.json': serializePreset(preset('A', {}, 'same')),
      'b.ccpreset.json': serializePreset(preset('B', {}, 'same')),
    });
    await setup(folder);

    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['A']);
    expect(library.getState().problems).toEqual(['b.ccpreset.json: same id as a.ccpreset.json, skipped']);
  });

  it('stays as it was if the user cancels the picker', async () => {
    library = createLibraryStore(editor, deps(null));
    await library.getState().pickFolder();
    expect(library.getState().folderName).toBeNull();
  });
});

describe('the remembered Library folder', () => {
  /** A launch: a fresh Library that opens the folder remembered from the last one. */
  async function launch() {
    library = createLibraryStore(editor, deps(null));
    await library.getState().openRememberedFolder();
  }

  it('is the folder last picked', async () => {
    const first = memoryFolder().folder;
    const second = memoryFolder().folder;
    await setup(first);
    expect(remembered).toBe(first);

    library = createLibraryStore(editor, deps(second));
    await library.getState().pickFolder();
    expect(remembered).toBe(second);
  });

  it('leaves the Library as it was when there is none', async () => {
    await launch();
    expect(library.getState()).toMatchObject({ folderName: null, storage: null, remembered: null });
  });

  it('opens silently when the browser still allows it', async () => {
    const { folder, asked } = memoryFolder({ 'zed.ccpreset.json': serializePreset(preset('Zed')) });
    remembered = folder;

    await launch();

    expect(library.getState()).toMatchObject({ folderName: 'My Presets', storage: 'folder', remembered: null });
    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['Zed']);
    expect(asked.count).toBe(0);
  });

  it('shows it is opening while the folder is read', async () => {
    let finishListing!: () => void;
    const { folder } = memoryFolder();
    remembered = { ...folder, list: () => new Promise((resolve) => (finishListing = () => resolve([]))) };
    library = createLibraryStore(editor, deps(null));

    const opening = library.getState().openRememberedFolder();
    await vi.waitUntil(() => finishListing);
    expect(library.getState().remembered).toEqual({ name: 'My Presets', status: 'opening' });
    finishListing();
    await opening;

    expect(library.getState()).toMatchObject({ folderName: 'My Presets', remembered: null });
  });

  it('waits for a click when the browser needs to ask, then opens on Reopen', async () => {
    const { folder, asked } = memoryFolder({ 'zed.ccpreset.json': serializePreset(preset('Zed')) }, 'prompt', 'granted');
    remembered = folder;

    await launch();
    expect(library.getState()).toMatchObject({
      folderName: null,
      remembered: { name: 'My Presets', status: 'needsPermission' },
    });
    expect(asked.count).toBe(0);

    await library.getState().reopenFolder();

    expect(asked.count).toBe(1);
    expect(library.getState()).toMatchObject({ folderName: 'My Presets', storage: 'folder', remembered: null });
    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['Zed']);
  });

  it('is kept, still waiting, when the user refuses', async () => {
    const { folder } = memoryFolder({}, 'prompt', 'denied');
    remembered = folder;
    await launch();

    await library.getState().reopenFolder();

    expect(library.getState()).toMatchObject({
      folderName: null,
      remembered: { name: 'My Presets', status: 'needsPermission' },
    });
    expect(remembered).toBe(folder);
  });

  it('is forgotten when the folder has gone', async () => {
    remembered = goneFolder();

    await launch();

    expect(library.getState()).toMatchObject({ folderName: null, remembered: { name: 'My Presets', status: 'gone' } });
    expect(remembered).toBeNull();
  });

  it('is opened by Save As, in the same click, which then carries on', async () => {
    const { folder, files, asked } = memoryFolder({}, 'prompt', 'granted');
    remembered = folder;
    await launch();

    await library.getState().saveAs('Shimmer Tape');

    expect(asked.count).toBe(1);
    expect(Object.keys(files)).toEqual(['shimmer-tape.ccpreset.json']);
    expect(library.getState()).toMatchObject({ folderName: 'My Presets', remembered: null });
  });

  it('says access was refused when a Library action can’t open it', async () => {
    const { folder, files } = memoryFolder({}, 'prompt', 'denied');
    remembered = folder;
    await launch();

    await expect(library.getState().saveAs('Shimmer Tape')).rejects.toThrow(
      'Access to the folder ‘My Presets’ wasn’t allowed',
    );
    expect(files).toEqual({});
    expect(library.getState().remembered).toEqual({ name: 'My Presets', status: 'needsPermission' });
  });

  it('says the folder has gone when a Library action finds it so', async () => {
    remembered = { ...goneFolder(), queryPermission: async () => 'prompt' };
    await launch();

    await expect(library.getState().saveAs('Shimmer Tape')).rejects.toThrow(
      'Couldn’t find the folder ‘My Presets’. Choose it again.',
    );
    expect(library.getState().remembered).toEqual({ name: 'My Presets', status: 'gone' });
    expect(remembered).toBeNull();
  });

  it('gives way to a folder picked while it is still being read', async () => {
    let finishListing!: () => void;
    const old = memoryFolder({ 'old.ccpreset.json': serializePreset(preset('Old')) }).folder;
    remembered = { ...old, list: () => new Promise((resolve) => (finishListing = () => resolve(['old.ccpreset.json']))) };
    const picked = memoryFolder({ 'new.ccpreset.json': serializePreset(preset('New')) }).folder;
    library = createLibraryStore(editor, deps(picked));

    const launching = library.getState().openRememberedFolder();
    await vi.waitUntil(() => finishListing);
    await library.getState().pickFolder();
    finishListing();
    await launching;

    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['New']);
    expect(library.getState().remembered).toBeNull();
    expect(remembered).toBe(picked);
  });
});

describe('Save As', () => {
  it('writes the Working State as a new Preset file, which the Working State then belongs to', async () => {
    const { folder, files } = memoryFolder();
    await setup(folder);
    expect(workingLabel()).toBe('Untitled');
    editor.getState().setParam('tilt', 90);
    expect(workingLabel()).toBe('Untitled •');

    await library.getState().saveAs('  Shimmer Tape ');

    expect(Object.keys(files)).toEqual(['shimmer-tape.ccpreset.json']);
    expect(presetIn(files, 'shimmer-tape.ccpreset.json')).toEqual({
      id: 'new-1',
      name: 'Shimmer Tape',
      notes: '',
      tags: [],
      createdAt: '2026-10-05T00:00:00.000Z',
      modifiedAt: '2026-10-05T00:00:00.000Z',
      params: { ...defaultWorkingState(), tilt: 90 },
    });
    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['Shimmer Tape']);
    expect(workingLabel()).toBe('Shimmer Tape');
  });

  it('keeps the notes and tags of the Preset the Working State came from', async () => {
    const shimmer = { ...preset('Shimmer Tape'), notes: 'Big wash', tags: ['ambient'] };
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);

    await library.getState().saveAs('Shimmer Tape II');

    expect(presetIn(files, 'shimmer-tape-ii.ccpreset.json')).toMatchObject({ id: 'new-1', notes: 'Big wash', tags: ['ambient'] });
    expect(library.getState().source.presetId).toBe('new-1');
  });

  it('numbers the file name when another file already has it', async () => {
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(preset('Shimmer Tape')) });
    await setup(folder);

    await library.getState().saveAs('Shimmer tape!');
    await library.getState().saveAs('shimmer TAPE');

    expect(Object.keys(files).sort()).toEqual([
      'shimmer-tape-2.ccpreset.json',
      'shimmer-tape-3.ccpreset.json',
      'shimmer-tape.ccpreset.json',
    ]);
  });

  it('refuses a blank name', async () => {
    const { folder, files } = memoryFolder();
    await setup(folder);
    await expect(library.getState().saveAs('   ')).rejects.toThrow('A Preset needs a name');
    expect(files).toEqual({});
  });
});

describe('the modified marker', () => {
  it('shows after an edit and clears when the edit is put back', async () => {
    await setup(memoryFolder().folder);
    await library.getState().saveAs('Shimmer Tape');
    editor.getState().setParam('sensitivity', 100);
    expect(workingLabel()).toBe('Shimmer Tape •');
    editor.getState().setParam('sensitivity', 64);
    expect(workingLabel()).toBe('Shimmer Tape');
  });
});

describe('opening a Preset', () => {
  it('makes it the Working State and sends it to the pedal', async () => {
    const shimmer = preset('Shimmer Tape', { characterEffect: 76, tilt: 90, diffusionEngaged: 0, filterStyle: 107 });
    const { folder } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    editor.getState().setParam('sensitivity', 10);

    await library.getState().openPreset(shimmer.id);

    expect(editor.getState().editor.working).toEqual(shimmer.params);
    expect(workingLabel()).toBe('Shimmer Tape');
    expect(virtualPedal.getSnapshot().state).toEqual(shimmer.params);
  });

  it('is Possibly Stale until its Send All has finished, then In Sync', async () => {
    const shimmer = preset('Shimmer Tape', { tilt: 99 });
    await setup(memoryFolder({ 's.ccpreset.json': serializePreset(shimmer) }).folder);
    editor.setState((s) => ({ editor: { ...s.editor, sync: 'inSync' } }));

    const opening = library.getState().openPreset(shimmer.id);
    expect(syncStatus(editor.getState().editor)).toBe('possiblyStale');
    await opening;
    expect(syncStatus(editor.getState().editor)).toBe('inSync');
  });

  it('refuses a Preset no longer in the Library', async () => {
    await setup(memoryFolder().folder);
    await expect(library.getState().openPreset('gone')).rejects.toThrow('That Preset is no longer in the Library');
  });
});

describe('New', () => {
  it('starts an Untitled Working State from the neutral Preset and sends it', async () => {
    await setup(memoryFolder().folder);
    await library.getState().saveAs('Shimmer Tape');
    editor.getState().setParam('mix', 3);
    editor.getState().selectEffect('characterEffect', 'howl');

    await library.getState().newWorkingState();

    expect(editor.getState().editor.working).toEqual(defaultWorkingState());
    expect(workingLabel()).toBe('Untitled');
    expect(virtualPedal.getSnapshot().state).toEqual(defaultWorkingState());
  });
});

describe('Save', () => {
  it('writes the Working State back to the Preset it came from, keeping its identity', async () => {
    const shimmer = { ...preset('Shimmer Tape'), notes: 'Big wash', tags: ['ambient'] };
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);
    editor.getState().setParam('outputLevel', 100);

    expect(await library.getState().save()).toBe(true);

    expect(Object.keys(files)).toEqual(['shimmer-tape.ccpreset.json']);
    expect(presetIn(files, 'shimmer-tape.ccpreset.json')).toEqual({
      ...shimmer,
      modifiedAt: '2026-10-05T00:00:00.000Z',
      params: { ...shimmer.params, outputLevel: 100 },
    });
    expect(library.getState().presets[0]!.preset.params.outputLevel).toBe(100);
    expect(workingLabel()).toBe('Shimmer Tape');
  });

  it('asks for a name instead when the Working State has no Preset', async () => {
    const { folder, files } = memoryFolder();
    await setup(folder);
    editor.getState().setParam('outputLevel', 100);

    expect(await library.getState().save()).toBe(false);
    expect(files).toEqual({});
    expect(workingLabel()).toBe('Untitled •');
  });
});

describe('editing a Preset’s details', () => {
  it('renames the Preset and its file, keeping its id, and sets its notes and tags', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);

    await library.getState().editDetails(shimmer.id, {
      name: 'Glass Choir',
      notes: 'Record a Gesture on Rate first.',
      tags: 'pad, ambient',
    });

    expect(Object.keys(files)).toEqual(['glass-choir.ccpreset.json']);
    expect(presetIn(files, 'glass-choir.ccpreset.json')).toEqual({
      ...shimmer,
      name: 'Glass Choir',
      notes: 'Record a Gesture on Rate first.',
      tags: ['pad', 'ambient'],
      modifiedAt: '2026-10-05T00:00:00.000Z',
    });
    expect(library.getState().presets.map((p) => [p.preset.name, p.fileName])).toEqual([
      ['Glass Choir', 'glass-choir.ccpreset.json'],
    ]);
    expect(workingLabel()).toBe('Glass Choir');
  });

  it('leaves the Preset’s params alone, even with the Working State edited', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);
    editor.getState().setParam('mix', 10);

    await library.getState().editDetails(shimmer.id, { name: 'Shimmer Tape', notes: 'Wash', tags: '' });

    expect(presetIn(files, 'shimmer-tape.ccpreset.json').params).toEqual(shimmer.params);
    expect(workingLabel()).toBe('Shimmer Tape •');
  });

  it('keeps the file name when the name still slugs the same', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);

    await library.getState().editDetails(shimmer.id, { name: 'Shimmer tape', notes: '', tags: '' });

    expect(Object.keys(files)).toEqual(['shimmer-tape.ccpreset.json']);
    expect(presetIn(files, 'shimmer-tape.ccpreset.json').name).toBe('Shimmer tape');
  });

  it('keeps a file whose name differs only in case, as on a case-insensitive disk it is the same file', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'Shimmer-Tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);

    await library.getState().editDetails(shimmer.id, { name: 'Shimmer tape', notes: '', tags: '' });

    expect(Object.keys(files)).toEqual(['Shimmer-Tape.ccpreset.json']);
    expect(presetIn(files, 'Shimmer-Tape.ccpreset.json').name).toBe('Shimmer tape');
  });

  it('refuses a blank name, writing nothing', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);

    await expect(library.getState().editDetails(shimmer.id, { name: ' ', notes: 'x', tags: '' })).rejects.toThrow(
      'A Preset needs a name',
    );
    expect(presetIn(files, 'shimmer-tape.ccpreset.json')).toEqual(shimmer);
  });
});

describe('Duplicate', () => {
  it('writes a copy as a new Preset and leaves the Working State alone', async () => {
    const shimmer = { ...preset('Shimmer Tape', { sensitivity: 20 }), notes: 'Big wash', tags: ['ambient'] };
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);

    await library.getState().duplicate(shimmer.id);

    expect(presetIn(files, 'shimmer-tape-copy.ccpreset.json')).toEqual({
      ...shimmer,
      id: 'new-1',
      name: 'Shimmer Tape copy',
      createdAt: '2026-10-05T00:00:00.000Z',
      modifiedAt: '2026-10-05T00:00:00.000Z',
    });
    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['Shimmer Tape', 'Shimmer Tape copy']);
    expect(library.getState().source.presetId).toBe(shimmer.id);
  });
});

describe('Delete', () => {
  it('removes the Preset file; a Working State opened from it keeps going without a Preset', async () => {
    const shimmer = preset('Shimmer Tape');
    const { folder, files } = memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) });
    await setup(folder);
    await library.getState().openPreset(shimmer.id);

    await library.getState().deletePreset(shimmer.id);

    expect(files).toEqual({});
    expect(library.getState().presets).toEqual([]);
    expect(library.getState().source.presetId).toBeNull();
    expect(workingLabel()).toBe('Shimmer Tape');
    expect(await library.getState().save()).toBe(false);
  });
});

describe('recalling a Slot', () => {
  const committed = { ...defaultWorkingState(), tilt: 20 };
  /** Slot B-14 (PC 33) holds what was committed from the Preset `presetId`. */
  function commitToB14(presetId: string | null) {
    const entry = { committed, presetId, name: 'Shimmer Tape' };
    editor.setState({ editor: { ...editor.getState().editor, slotMap: { 33: entry } } });
  }

  it('makes a known Slot’s committed state the Working State, belonging to its Preset', async () => {
    const shimmer = preset('Shimmer Tape', { tilt: 20 });
    await setup(memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) }).folder);
    commitToB14(shimmer.id);

    expect(library.getState().recallSlot(33)).toBe(true);

    expect(editor.getState().editor.working).toEqual(committed);
    expect(syncStatus(editor.getState().editor)).toBe('possiblyStale');
    expect(library.getState().source.presetId).toBe(shimmer.id);
    expect(workingLabel()).toBe('Shimmer Tape');
    expect(virtualPedal.getSnapshot().log.at(-1)?.text).toBe('PC 33 → Recall Slot B-14');
  });

  it('shows the Working State as modified when its Preset has changed since the commit, so Save can’t put the older one back quietly', async () => {
    const shimmer = preset('Renamed', { tilt: 90 });
    await setup(memoryFolder({ 'renamed.ccpreset.json': serializePreset(shimmer) }).folder);
    commitToB14(shimmer.id);

    library.getState().recallSlot(33);

    expect(editor.getState().editor.working).toEqual(committed);
    expect(workingLabel()).toBe('Renamed •');
  });

  it('keeps the committed name, with no Preset, once the Preset has been deleted', async () => {
    await setup(memoryFolder().folder);
    commitToB14('gone');

    library.getState().recallSlot(33);

    expect(library.getState().source.presetId).toBeNull();
    expect(workingLabel()).toBe('Shimmer Tape');
  });

  it('leaves the Working State and its Preset alone on an unknown Slot', async () => {
    const shimmer = preset('Shimmer Tape');
    await setup(memoryFolder({ 'shimmer-tape.ccpreset.json': serializePreset(shimmer) }).folder);
    await library.getState().openPreset(shimmer.id);
    editor.getState().setParam('mix', 3);
    const source = library.getState().source;

    library.getState().recallSlot(0);

    expect(library.getState().source).toBe(source);
    expect(workingLabel()).toBe('Shimmer Tape •');
    expect(syncStatus(editor.getState().editor)).toBe('unknown');
  });
});

describe('Slot info', () => {
  it('names a known Slot by its Preset, marking it changed since commit, and knows nothing of other Slots', () => {
    const shimmer = preset('Renamed', { tilt: 90 });
    const entry = { committed: defaultWorkingState(), presetId: shimmer.id, name: 'Shimmer Tape' };
    const presets = [{ preset: shimmer, fileName: 'renamed.ccpreset.json' }];

    expect(slotInfo({ 33: entry }, presets, 33)).toEqual({ entry, preset: shimmer, name: 'Renamed', changed: true });
    expect(slotInfo({ 33: entry }, presets, 0)).toBeUndefined();
  });
});

describe('the browser storage Library', () => {
  it('keeps Presets like a folder, under its own name', async () => {
    const { folder, files } = memoryFolder({ 'zed.ccpreset.json': serializePreset(preset('Zed')) });
    library = createLibraryStore(editor, deps(null, folder));

    await library.getState().openBrowserStorage();
    await library.getState().saveAs('Shimmer Tape');

    expect(library.getState()).toMatchObject({ storage: 'browser', folderName: 'Browser storage' });
    expect(library.getState().presets.map((p) => p.preset.name)).toEqual(['Shimmer Tape', 'Zed']);
    expect(Object.keys(files)).toContain('shimmer-tape.ccpreset.json');
  });

  it('a folder Library is a folder', async () => {
    await setup(memoryFolder().folder);
    expect(library.getState().storage).toBe('folder');
  });
});
