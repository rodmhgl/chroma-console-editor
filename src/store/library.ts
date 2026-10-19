import { create } from 'zustand';
import type { PresetParamId } from '../midi/map';
import { PRESET_EXTENSION, parsePreset, presetName, presetTags, serializePreset, type Preset } from '../model/schema';
import { defaultWorkingState, type WorkingState } from '../model/state';
import { useEditorStore, type createEditorStore } from './editorStore';

// The Library: Presets kept as real files in a folder the user picks, or in browser storage where the browser
// can't open a folder (SPEC.md, Library and files). Library file operations are written at once and never undoable.

/**
 * A folder of files. The browser's File System Access API in the app, or IndexedDB where there is none; in
 * memory in tests.
 */
export type LibraryFolder = {
  name: string;
  list(): Promise<string[]>;
  read(fileName: string): Promise<string>;
  write(fileName: string, text: string): Promise<void>;
  remove(fileName: string): Promise<void>;
};

/**
 * A folder the user picked, which the browser hands back at a later launch once the user allows it again: a
 * FileSystemDirectoryHandle in the app.
 */
export type PickedFolder = LibraryFolder & {
  /** Whether the browser lets the app use the folder now, without asking. */
  queryPermission(): Promise<PermissionState>;
  /** Asks the user to let the app use the folder. Only works in a click. */
  requestPermission(): Promise<PermissionState>;
};

/**
 * A remembered folder that isn't open: being read at launch, waiting for a click to allow it again, or deleted
 * since it was picked (and so forgotten).
 */
export type RememberedFolder = { name: string; status: 'opening' | 'needsPermission' | 'gone' };

/** A Preset and the file that holds it. */
export type LibraryEntry = { preset: Preset; fileName: string };

/** Where the Library is kept: a folder on disk, or the browser's own storage. */
export type LibraryStorage = 'folder' | 'browser';

export type LibraryDeps = {
  /** Asks the user for a folder; null if they cancel. */
  pickFolder(): Promise<PickedFolder | null>;
  /** The folder last picked, kept across launches. */
  rememberedFolder: {
    load(): Promise<PickedFolder | null>;
    save(folder: PickedFolder): Promise<void>;
    clear(): Promise<void>;
  };
  /** The Library kept in the browser's own storage, for browsers that can't open a folder. */
  openBrowserStorage(): Promise<LibraryFolder>;
  /** The current time as an ISO string. */
  now(): string;
  /** A fresh Preset id (UUID). */
  newId(): string;
};

/** A Preset's details as the user types them: tags as one comma-separated line. */
export type PresetDetails = { name: string; notes: string; tags: string };

/** The browser storage Library's name, where a folder Library shows the folder's. */
export const BROWSER_STORAGE_NAME = 'Browser storage';

/**
 * What the Working State was opened from or last saved as. `presetId` is null for a Working State that
 * has no Preset (at launch, after New, or once its Preset is deleted).
 */
export type WorkingSource = { presetId: string | null; name: string; params: WorkingState };

/** The name a Working State with no Preset shows. */
export const UNTITLED = 'Untitled';

/** Whether the Working State has been edited since it was opened or saved: shown as "•". */
export function isModified(working: WorkingState, source: WorkingSource): boolean {
  return (Object.keys(source.params) as PresetParamId[]).some((id) => working[id] !== source.params[id]);
}

/** Explains the "•" after the Working State's name. */
export const MODIFIED_HELP = 'Edited since it was opened or saved';

/** A Working State that belongs to this Preset. */
const sourceOf = (preset: Preset): WorkingSource => ({ presetId: preset.id, name: preset.name, params: preset.params });

type LibraryStore = {
  storage: LibraryStorage | null;
  /** The folder's name, or "Browser storage". */
  folderName: string | null;
  /** The folder picked at an earlier launch, while it isn't open. */
  remembered: RememberedFolder | null;
  /** The folder's Presets, by name. */
  presets: LibraryEntry[];
  /** Files skipped or changed on load, one line each. */
  problems: string[];
  source: WorkingSource;
  /** Asks the user for a folder, opens it and remembers it for the next launch. */
  pickFolder(): Promise<void>;
  /** At launch: opens the folder picked at an earlier launch if the browser still allows it, without asking. */
  openRememberedFolder(): Promise<void>;
  /** Asks the user to allow the remembered folder again (in a click), then opens it. */
  reopenFolder(): Promise<void>;
  /** Opens the Library kept in browser storage, for browsers that can't open a folder. */
  openBrowserStorage(): Promise<void>;
  /** Writes the Working State as a new Preset, keeping its Preset's notes and tags; the Working State then belongs to it. */
  saveAs(name: string): Promise<void>;
  /** Makes a Preset the Working State and sends it. The UI warns first when that discards unsaved edits. */
  openPreset(id: string): Promise<void>;
  /** Starts an Untitled Working State from the neutral Preset and sends it. Nothing is written until it is saved. */
  newWorkingState(): Promise<void>;
  /** Writes the Working State back to its Preset. Resolves false, writing nothing, if it has no Preset yet: Save As instead. */
  save(): Promise<boolean>;
  /**
   * Sets a Preset's name, notes and tags, renaming its file where the name slugs differently. Its id and params are
   * kept, so unsaved Working State edits stay unsaved.
   */
  editDetails(id: string, details: PresetDetails): Promise<void>;
  /** Writes a copy of a Preset as a new Preset. */
  duplicate(id: string): Promise<void>;
  /** Deletes a Preset's file. The File System Access API has no trash, so this is permanent: the UI confirms first. */
  deletePreset(id: string): Promise<void>;
};

type EditorStoreApi = ReturnType<typeof createEditorStore>;

/**
 * Only JSON files are read, so the scan never opens audio or other large files in the folder; each file's
 * `format` then decides whether it is a Preset.
 */
const isJson = (fileName: string) => fileName.toLowerCase().endsWith('.json');

/** "Shimmer Tape" → `shimmer-tape`. */
const slugOf = (name: string, fallback: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || fallback;

/** `shimmer-tape.ccpreset.json` for "Shimmer Tape", then `-2`, `-3`… if a file already has that name. */
function presetFileName(name: string, taken: string[]): string {
  const slug = slugOf(name, 'preset');
  const used = new Set(taken.map((t) => t.toLowerCase()));
  for (let n = 1; ; n++) {
    const fileName = `${slug}${n > 1 ? `-${n}` : ''}${PRESET_EXTENSION}`;
    if (!used.has(fileName)) return fileName;
  }
}

const byName = (a: LibraryEntry, b: LibraryEntry) => a.preset.name.localeCompare(b.preset.name);

async function readFolder(folder: LibraryFolder) {
  const presets: LibraryEntry[] = [];
  const problems: string[] = [];
  for (const fileName of (await folder.list()).filter(isJson).sort()) {
    const result = parsePreset(await folder.read(fileName));
    if (!result.ok) {
      problems.push(`${fileName}: ${result.error}`);
      continue;
    }
    const twin = presets.find((p) => p.preset.id === result.preset.id);
    if (twin) {
      problems.push(`${fileName}: same id as ${twin.fileName}, skipped`);
      continue;
    }
    problems.push(...result.warnings.map((w) => `${fileName}: ${w}`));
    presets.push({ preset: result.preset, fileName });
  }
  return { presets: presets.sort(byName), problems };
}

/** Whether there is a Library to save to, or one a click can reopen. */
export function libraryReachable(library: { folderName: string | null; remembered: RememberedFolder | null }): boolean {
  return library.folderName !== null || (library.remembered !== null && library.remembered.status !== 'gone');
}

/** What the Library shows for a remembered folder that has gone. */
export const goneMessage = (name: string) => `Couldn’t find the folder ‘${name}’. Choose it again.`;

const isNotFound = (e: unknown) => e instanceof DOMException && e.name === 'NotFoundError';

export function createLibraryStore(editor: EditorStoreApi, deps: LibraryDeps) {
  let folder: LibraryFolder | null = null;
  /** The folder picked at an earlier launch, until it opens or is found gone. */
  let unopened: PickedFolder | null = null;
  /** Opening the remembered folder at launch. */
  let launching: Promise<void> | undefined;
  /** Counts opens, so a folder that finishes reading after a later one started doesn't replace it. */
  let opens = 0;
  const validName = (input: string) => {
    const name = presetName(input);
    if (!name) throw new Error('A Preset needs a name');
    return name;
  };

  return create<LibraryStore>((set, get) => {
    /**
     * The open Library, opening a remembered folder first: one that needs the user's permission asks in the same
     * click, so a Library action never fails just because the app was relaunched.
     */
    const openFolder = async () => {
      // A launch that failed has said so already; the remembered folder, if kept, is tried again below.
      await launching?.catch(() => {});
      if (!folder && unopened) {
        const { name } = unopened;
        await openRemembered(unopened, true);
        if (get().remembered?.status === 'gone') throw new Error(goneMessage(name));
        if (!folder) throw new Error(`Access to the folder ‘${name}’ wasn’t allowed`);
      }
      if (!folder) throw new Error('Pick a Library folder first');
      return folder;
    };
    /** Writes a Preset into a new file and adds it to the list. */
    const addFile = async (preset: Preset) => {
      const target = await openFolder();
      const fileName = presetFileName(preset.name, await target.list());
      await target.write(fileName, serializePreset(preset));
      set({ presets: [...get().presets, { preset, fileName }].sort(byName) });
    };

    /** Writes a changed Preset over its file, or into a new one, and updates the list. */
    const rewrite = async (old: LibraryEntry, preset: Preset, fileName = old.fileName) => {
      const target = await openFolder();
      await target.write(fileName, serializePreset(preset));
      if (fileName !== old.fileName) await target.remove(old.fileName);
      set({
        presets: get()
          .presets.map((p) => (p === old ? { preset, fileName } : p))
          .sort(byName),
      });
    };
    /** Writes a Preset over `old`, renaming the file with it where the name slugs differently. */
    const replace = async (old: LibraryEntry, preset: Preset) => {
      let fileName = presetFileName(
        preset.name,
        (await (await openFolder()).list()).filter((f) => f !== old.fileName),
      );
      // On a case-insensitive disk (Windows, macOS) these are one file: writing one, then removing the other, loses it.
      if (fileName === old.fileName.toLowerCase()) fileName = old.fileName;
      await rewrite(old, preset, fileName);
    };
    /** A Preset in the Library. */
    const entry = (id: string) => {
      const found = get().presets.find((p) => p.preset.id === id);
      if (!found) throw new Error('That Preset is no longer in the Library');
      return found;
    };
    const open = async (opened: LibraryFolder, storage: LibraryStorage) => {
      const turn = ++opens;
      const contents = await readFolder(opened);
      if (turn !== opens) return;
      folder = opened;
      unopened = null;
      const folderName = storage === 'browser' ? BROWSER_STORAGE_NAME : opened.name;
      set({ storage, folderName, remembered: null, ...contents });
    };
    /** Opens the remembered folder if the browser allows it, asking the user first if `ask`. */
    const openRemembered = async (picked: PickedFolder, ask: boolean) => {
      const { name } = picked;
      try {
        const permission = await (ask ? picked.requestPermission() : picked.queryPermission());
        // A folder picked meanwhile replaces this one.
        if (unopened !== picked) return;
        if (permission !== 'granted') {
          set({ remembered: { name, status: 'needsPermission' } });
          return;
        }
        set({ remembered: { name, status: 'opening' } });
        await open(picked, 'folder');
      } catch (e) {
        if (!isNotFound(e)) {
          set({ remembered: { name, status: 'needsPermission' } });
          throw e;
        }
        if (unopened !== picked) return;
        unopened = null;
        set({ remembered: { name, status: 'gone' } });
        await deps.rememberedFolder.clear();
      }
    };
    /** Makes `params` the Working State, belonging to `source`, and Sends All. */
    const openWorking = async (source: WorkingSource) => {
      set({ source });
      await editor.getState().loadWorking(source.params);
    };

    return {
      storage: null,
      folderName: null,
      remembered: null,
      presets: [],
      problems: [],
      source: { presetId: null, name: UNTITLED, params: editor.getState().editor.working },
      async pickFolder() {
        const picked = await deps.pickFolder();
        if (!picked) return;
        unopened = null;
        await open(picked, 'folder');
        await deps.rememberedFolder.save(picked);
      },
      openRememberedFolder() {
        launching = (async () => {
          const picked = await deps.rememberedFolder.load();
          if (!picked || folder) return;
          unopened = picked;
          set({ remembered: { name: picked.name, status: 'opening' } });
          await openRemembered(picked, false);
        })();
        return launching;
      },
      async reopenFolder() {
        if (unopened) await openRemembered(unopened, true);
      },
      async openBrowserStorage() {
        await open(await deps.openBrowserStorage(), 'browser');
      },
      async saveAs(input) {
        const name = validName(input);
        const now = deps.now();
        const params = editor.getState().editor.working;
        const from = get().presets.find((p) => p.preset.id === get().source.presetId)?.preset;
        const preset: Preset = {
          id: deps.newId(),
          name,
          notes: from?.notes ?? '',
          tags: from?.tags ?? [],
          createdAt: now,
          modifiedAt: now,
          params,
        };
        await addFile(preset);
        set({ source: sourceOf(preset) });
      },
      async openPreset(id) {
        await openWorking(sourceOf(entry(id).preset));
      },
      async newWorkingState() {
        await openWorking({ presetId: null, name: UNTITLED, params: defaultWorkingState() });
      },
      async save() {
        await openFolder();
        const { presetId } = get().source;
        const old = get().presets.find((p) => p.preset.id === presetId);
        if (!old) return false;
        const params = editor.getState().editor.working;
        await rewrite(old, { ...old.preset, params, modifiedAt: deps.now() });
        set({ source: { ...get().source, params } });
        return true;
      },
      async editDetails(id, details) {
        const name = validName(details.name);
        const old = entry(id);
        const preset = { ...old.preset, name, notes: details.notes, tags: presetTags(details.tags), modifiedAt: deps.now() };
        await replace(old, preset);
        if (get().source.presetId === id) set({ source: { ...get().source, name } });
      },
      async duplicate(id) {
        const { preset } = entry(id);
        const now = deps.now();
        const name = presetName(`${preset.name} copy`) ?? preset.name;
        await addFile({ ...preset, id: deps.newId(), name, createdAt: now, modifiedAt: now });
      },
      async deletePreset(id) {
        const old = entry(id);
        await (await openFolder()).remove(old.fileName);
        set({ presets: get().presets.filter((p) => p !== old) });
        if (get().source.presetId === id) set({ source: { ...get().source, presetId: null } });
      },
    };
  });
}

/** The browser lets the user pick a folder (File System Access API: Chrome, Edge). Otherwise the Library is kept in IndexedDB. */
export const folderAccessAvailable = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** The folders the user picked, as the browser keeps them, so they can be remembered. */
const directories = new WeakMap<PickedFolder, FileSystemDirectoryHandle>();

/** A folder on disk, through the File System Access API. */
export function directoryFolder(dir: FileSystemDirectoryHandle): PickedFolder {
  const folder: PickedFolder = {
    name: dir.name,
    queryPermission: () => dir.queryPermission({ mode: 'readwrite' }),
    requestPermission: () => dir.requestPermission({ mode: 'readwrite' }),
    async list() {
      const names: string[] = [];
      for await (const handle of dir.values()) if (handle.kind === 'file') names.push(handle.name);
      return names;
    },
    async read(fileName) {
      return (await (await dir.getFileHandle(fileName)).getFile()).text();
    },
    async write(fileName, text) {
      const writable = await (await dir.getFileHandle(fileName, { create: true })).createWritable();
      await writable.write(text);
      await writable.close();
    },
    async remove(fileName) {
      await dir.removeEntry(fileName);
    },
  };
  directories.set(folder, dir);
  return folder;
}

async function pickDirectory(): Promise<PickedFolder | null> {
  try {
    return directoryFolder(await window.showDirectoryPicker({ id: 'chroma-library', mode: 'readwrite' }));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

const LIBRARY_DB = 'chroma-library';
/** The browser storage Library's Preset files. */
const FILES_STORE = 'files';
/** The remembered Library folder. */
const FOLDER_STORE = 'folder';
const FOLDER_KEY = 'library';

function openLibraryDb() {
  const open = indexedDB.open(LIBRARY_DB, 1);
  open.onupgradeneeded = () => {
    for (const store of [FILES_STORE, FOLDER_STORE])
      if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store);
  };
  return settle(open);
}

/** Runs one IndexedDB request in its own transaction. */
async function inStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const tx = db.transaction(storeName, mode);
  const result = await settle(request(tx.objectStore(storeName)));
  // A write only counts once its transaction has committed.
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  return result;
}

function settle<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * The Library in the browser's IndexedDB, for browsers without the File System Access API: the same Preset files,
 * keyed by file name, so everything else treats it as a folder. Clearing the browser's site data loses it.
 */
export async function indexedDbFolder(): Promise<LibraryFolder> {
  const db = await openLibraryDb();
  const inFiles = <T>(mode: IDBTransactionMode, request: (files: IDBObjectStore) => IDBRequest<T>) =>
    inStore(db, FILES_STORE, mode, request);
  return {
    name: BROWSER_STORAGE_NAME,
    async list() {
      return (await inFiles('readonly', (files) => files.getAllKeys())).map(String);
    },
    async read(fileName) {
      const text = await inFiles('readonly', (files) => files.get(fileName));
      if (typeof text !== 'string') throw new Error(`${fileName} is no longer in the Library`);
      return text;
    },
    async write(fileName, text) {
      await inFiles('readwrite', (files) => files.put(text, fileName));
    },
    async remove(fileName) {
      await inFiles('readwrite', (files) => files.delete(fileName));
    },
  };
}

/**
 * The remembered folder's handle in IndexedDB, which the browser can store and hand back. Any failure only means the
 * folder is picked again next launch.
 */
const indexedDbRememberedFolder: LibraryDeps['rememberedFolder'] = {
  async load() {
    const dir = await inFolderStore('readonly', (s) => s.get(FOLDER_KEY));
    return dir instanceof FileSystemDirectoryHandle ? directoryFolder(dir) : null;
  },
  async save(folder) {
    // Only a folder from the picker (or loaded here) has a handle the browser can keep.
    const dir = directories.get(folder);
    if (dir) await inFolderStore('readwrite', (s) => s.put(dir, FOLDER_KEY));
  },
  async clear() {
    await inFolderStore('readwrite', (s) => s.delete(FOLDER_KEY));
  },
};

/** Runs one request on the remembered folder's store; any failure resolves undefined. */
async function inFolderStore(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  try {
    return await inStore(await openLibraryDb(), FOLDER_STORE, mode, request);
  } catch {
    return undefined;
  }
}

export const useLibraryStore = createLibraryStore(useEditorStore, {
  pickFolder: pickDirectory,
  openBrowserStorage: indexedDbFolder,
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
  rememberedFolder: indexedDbRememberedFolder,
});

// Without folder access the Library is always the browser's own, so it opens with the app. With it, the folder picked
// at an earlier launch opens alongside the first render, never holding it up.
if (typeof indexedDB !== 'undefined') {
  const library = useLibraryStore.getState();
  (folderAccessAvailable ? library.openRememberedFolder() : library.openBrowserStorage()).catch((e: unknown) =>
    useLibraryStore.setState({
      problems: [`${folderAccessAvailable ? 'Library folder' : BROWSER_STORAGE_NAME}: ${String(e)}`],
    }),
  );
}

/** Whether the app's Working State has been edited since it was opened or saved. */
export function useWorkingStateModified(): boolean {
  const source = useLibraryStore((s) => s.source);
  return useEditorStore((s) => isModified(s.editor.working, source));
}
