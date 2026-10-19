import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStore, startApp, type AppPlatform, type InstallPromptEvent } from './appStore';

/** Storage the browser grants on the `grantOn`th request (never when 0). */
function fakeStorage(grantOn: number) {
  let persisted = false;
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => {
      requests += 1;
      if (grantOn > 0 && requests >= grantOn) persisted = true;
      return persisted;
    }),
  };
}

function installPromptEvent(): InstallPromptEvent {
  return Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => {}) });
}

let store: ReturnType<typeof createAppStore>;
let events: EventTarget;

beforeEach(() => {
  store = createAppStore();
  events = new EventTarget();
});

function start(platform: Partial<AppPlatform> = {}) {
  return startApp(store, { events, storage: fakeStorage(0), standalone: false, ...platform });
}

/** Lets the persistence requests started by `startApp` settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('persistent storage', () => {
  it('is Kept when the browser already keeps it, without asking again', async () => {
    const storage = fakeStorage(1);
    await storage.persist();
    start({ storage });
    await settle();
    expect(store.getState().storage).toBe('kept');
    expect(storage.requests).toBe(1);
  });

  it('asks on launch and is Kept when granted', async () => {
    const storage = fakeStorage(1);
    start({ storage });
    await settle();
    expect(storage.requests).toBe(1);
    expect(store.getState().storage).toBe('kept');
  });

  it('may be cleared when refused, and asks again once the app is installed', async () => {
    const storage = fakeStorage(2);
    start({ storage });
    await settle();
    expect(store.getState().storage).toBe('mayBeCleared');

    events.dispatchEvent(new Event('appinstalled'));
    await settle();
    expect(storage.requests).toBe(2);
    expect(store.getState().storage).toBe('kept');
  });

  it('keeps the latest answer when an earlier one is slower', async () => {
    let refuseFirst = (_: boolean) => {};
    let requests = 0;
    start({
      storage: {
        persisted: async () => false,
        persist: () =>
          ++requests === 1 ? new Promise<boolean>((resolve) => (refuseFirst = resolve)) : Promise.resolve(true),
      },
    });
    events.dispatchEvent(new Event('appinstalled'));
    await settle();
    expect(store.getState().storage).toBe('kept');

    refuseFirst(false);
    await settle();
    expect(store.getState().storage).toBe('kept');
  });

  it('may be cleared without the Storage API', async () => {
    start({ storage: undefined });
    await settle();
    expect(store.getState().storage).toBe('mayBeCleared');
  });

  it('may be cleared when the request fails', async () => {
    start({ storage: { persisted: async () => false, persist: () => Promise.reject(new Error('denied')) } });
    await settle();
    expect(store.getState().storage).toBe('mayBeCleared');
  });
});

describe('install', () => {
  it('is offered once the browser offers it, holding back the browser’s own prompt', () => {
    start();
    expect(store.getState().installable).toBe(false);
    const event = installPromptEvent();
    events.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(store.getState().installable).toBe(true);
  });

  it('shows the browser’s prompt, which can only be used once', async () => {
    start();
    const event = installPromptEvent();
    events.dispatchEvent(event);
    await store.getState().install();
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(store.getState().installable).toBe(false);
  });

  it('is no longer offered once installed', () => {
    start();
    events.dispatchEvent(installPromptEvent());
    events.dispatchEvent(new Event('appinstalled'));
    expect(store.getState()).toMatchObject({ installed: true, installable: false });
  });

  it('knows it is installed when running in its own window', () => {
    start({ standalone: true });
    expect(store.getState().installed).toBe(true);
  });

  it('stops listening when stopped', () => {
    const stop = start();
    stop();
    events.dispatchEvent(installPromptEvent());
    expect(store.getState().installable).toBe(false);
  });
});

describe('updates', () => {
  it('waits for Reload when a new version is ready', () => {
    let needRefresh = () => {};
    const applyUpdate = vi.fn(async () => {});
    start({
      registerServiceWorker: ({ onNeedRefresh }) => {
        needRefresh = onNeedRefresh;
        return applyUpdate;
      },
    });
    expect(store.getState().updateWaiting).toBe(false);

    needRefresh();
    expect(store.getState().updateWaiting).toBe(true);
    expect(applyUpdate).not.toHaveBeenCalled();

    store.getState().reload();
    expect(applyUpdate).toHaveBeenCalledOnce();
  });
});
