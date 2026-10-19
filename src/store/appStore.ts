import { create } from 'zustand';

/** Whether the browser has agreed to keep the editor's storage under storage pressure. */
export type StorageStatus = 'unknown' | 'kept' | 'mayBeCleared';

export const STORAGE_STATUS_LABELS: Record<Exclude<StorageStatus, 'unknown'>, string> = {
  kept: 'Kept',
  mayBeCleared: 'May be cleared by the browser',
};

export const STORAGE_STATUS_HELP: Record<StorageStatus, string> = {
  unknown: 'Asking the browser to keep the editor’s data.',
  kept: 'The browser won’t clear the editor’s data to free space. Clearing site data still does, so back up your Library.',
  mayBeCleared: 'The browser may clear the editor’s data when space runs low. Installing the app makes keeping it likelier.',
};

export const UPDATE_WAITING_HELP = 'A new version is ready. If you don’t reload, it applies next launch.';

/** Chrome and Edge's `beforeinstallprompt`; not yet in TypeScript's DOM lib. */
export type InstallPromptEvent = Event & { prompt(): Promise<void> };

/** The browser as the installed app sees it, so tests can fake it. */
export type AppPlatform = {
  /** Where `beforeinstallprompt` and `appinstalled` fire: the window. */
  events: EventTarget;
  storage?: Pick<StorageManager, 'persisted' | 'persist'>;
  /** Running in its own window, so already installed. */
  standalone: boolean;
  /** Registers the service worker; the result applies a waiting update, reloading the page. */
  registerServiceWorker?(callbacks: { onNeedRefresh(): void }): () => Promise<void>;
};

/** The installed app, as distinct from the Editor State. */
type InstalledAppState = {
  storage: StorageStatus;
  installable: boolean;
  installed: boolean;
  /** A new version is installed and waits for Reload, or the next launch. */
  updateWaiting: boolean;
  install(): Promise<void>;
  reload(): void;
};

export function createAppStore() {
  return create<InstalledAppState>(() => ({
    storage: 'unknown',
    installable: false,
    installed: false,
    updateWaiting: false,
    install: async () => {},
    reload: () => {},
  }));
}

/**
 * Asks the browser to keep storage on every launch until it does, and again on install, which raises Chrome and Edge's
 * odds of granting it (they never prompt). Offers Install and waits for Reload on a new version. Returns a stop function.
 */
export function startApp(store: ReturnType<typeof createAppStore>, platform: AppPlatform): () => void {
  const { events, storage } = platform;
  let installPrompt: InstallPromptEvent | null = null;
  let persistenceRequests = 0;

  const requestPersistence = async () => {
    // Only the latest request's answer counts, so a slow refusal at launch can't hide a grant on install.
    const request = ++persistenceRequests;
    let kept = false;
    try {
      kept = storage !== undefined && ((await storage.persisted()) || (await storage.persist()));
    } catch {
      // Refused.
    }
    if (request === persistenceRequests) store.setState({ storage: kept ? 'kept' : 'mayBeCleared' });
  };

  const onInstallPrompt = (event: Event) => {
    // Held back so the browser doesn't show its own mini-infobar; Settings offers Install instead.
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    store.setState({ installable: true });
  };
  const onInstalled = () => {
    installPrompt = null;
    store.setState({ installed: true, installable: false });
    void requestPersistence();
  };

  events.addEventListener('beforeinstallprompt', onInstallPrompt);
  events.addEventListener('appinstalled', onInstalled);

  const applyUpdate = platform.registerServiceWorker?.({ onNeedRefresh: () => store.setState({ updateWaiting: true }) });

  store.setState({
    installed: platform.standalone,
    async install() {
      const prompt = installPrompt;
      if (!prompt) return;
      // A prompt can only be shown once; the browser may offer another later.
      installPrompt = null;
      store.setState({ installable: false });
      await prompt.prompt();
    },
    reload() {
      void applyUpdate?.();
    },
  });
  void requestPersistence();

  return () => {
    events.removeEventListener('beforeinstallprompt', onInstallPrompt);
    events.removeEventListener('appinstalled', onInstalled);
  };
}

export const useAppStore = createAppStore();
