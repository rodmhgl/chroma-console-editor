import type { createEditorStore } from './editorStore';
import { UNTITLED, type WorkingSource } from './library';
import { SESSION_VERSION, parseSession, type Session } from './session';
import { uiSettingsOf, type UiSettings } from './settingsStore';

// Keeps the session between launches (SPEC.md story 86): restored before the app first renders, then saved as it
// changes. The panel layout keeps itself (layoutStore.ts).

/** Where the session is kept. `load` resolves whatever was stored, unchecked. */
export type SessionStorage = { load(): Promise<unknown>; save(session: Session): Promise<void> };

/** A store the session reads from and restores into. */
type Watched<T> = { getState(): T; setState(change: Partial<T>): void; subscribe(listener: () => void): () => void };

export type SessionStores = {
  editor: ReturnType<typeof createEditorStore>;
  library: Watched<{ source: WorkingSource }>;
  settings: Watched<UiSettings>;
};

/** The session as the stores hold it now. */
function sessionOf({ editor, library, settings }: SessionStores): Session {
  const { editor: state, sendGapMs } = editor.getState();
  return {
    version: SESSION_VERSION,
    working: state.working,
    snapshot: state.snapshot,
    slotMap: state.slotMap,
    confirmed: state.confirmed,
    midiChannel: state.global.midiChannel,
    source: library.getState().source,
    settings: { ...uiSettingsOf(settings.getState()), sendGapMs },
  };
}

/** Whether nothing kept has changed. The stores replace what they change, so comparing references is enough. */
function sameSession(a: Session, b: Session): boolean {
  const sameFields = <T extends object>(x: T, y: T) => (Object.keys(x) as (keyof T)[]).every((k) => x[k] === y[k]);
  return sameFields({ ...a, settings: null }, { ...b, settings: null }) && sameFields(a.settings, b.settings);
}

function restore(session: Session, { editor, library, settings }: SessionStores) {
  editor.getState().restore(session);
  settings.setState(uiSettingsOf(session.settings));
  library.setState({ source: session.source ?? { presetId: null, name: UNTITLED, params: session.working } });
}

/**
 * Saves the session whenever a kept part of it changes, one save at a time: changes made during a save are written
 * together once it finishes. A failed save is dropped; the next change tries again. Returns a function that stops.
 */
export function keepSession(storage: SessionStorage, stores: SessionStores): () => void {
  let last = sessionOf(stores);
  let pending: Session | null = null;
  let saving = false;

  const write = async () => {
    if (saving) return;
    saving = true;
    while (pending) {
      const session = pending;
      pending = null;
      await storage.save(session).catch(() => {});
    }
    saving = false;
  };
  const check = () => {
    const session = sessionOf(stores);
    if (sameSession(session, last)) return;
    last = pending = session;
    void write();
  };

  const stops = [stores.editor.subscribe(check), stores.library.subscribe(check), stores.settings.subscribe(check)];
  return () => stops.forEach((stop) => stop());
}

/** Restores the last session, if one can be read, then keeps the session from here on. */
export async function startSession(storage: SessionStorage, stores: SessionStores): Promise<() => void> {
  const session = parseSession(await storage.load().catch(() => undefined));
  if (session) restore(session, stores);
  return keepSession(storage, stores);
}

const SESSION_DB = 'chroma-session';
const SESSION_STORE = 'session';
const SESSION_KEY = 'last';

/** The session in the browser's IndexedDB. Clearing the browser's site data loses it. */
export function indexedDbSessionStorage(): SessionStorage {
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(SESSION_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(SESSION_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  const inStore = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
    const tx = (await open()).transaction(SESSION_STORE, mode);
    const request = run(tx.objectStore(SESSION_STORE));
    // A write only counts once its transaction has committed.
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    return request.result;
  };
  return {
    load: () => inStore('readonly', (store) => store.get(SESSION_KEY)),
    save: async (session) => {
      await inStore('readwrite', (store) => store.put(session, SESSION_KEY));
    },
  };
}
