import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { startApp, useAppStore } from './store/appStore';
import { useEditorStore } from './store/editorStore';
import { useLibraryStore } from './store/library';
import { indexedDbSessionStorage, startSession } from './store/persistence';
import { useSettingsStore } from './store/settingsStore';
import { App } from './ui/App';
import './ui/app.css';

startApp(useAppStore, {
  events: window,
  storage: navigator.storage,
  standalone: matchMedia('(display-mode: standalone)').matches,
  // Registered after load, so it doesn't compete with the first render. Absent under `vite dev`.
  registerServiceWorker: ({ onNeedRefresh }) => {
    const updateSW = registerSW({ onNeedRefresh });
    return () => updateSW(true);
  },
});

const render = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// The last session is restored before the first render, so the editor never shows defaults first. Without IndexedDB
// the editor starts from defaults and keeps nothing.
if (typeof indexedDB === 'undefined') render();
else
  void startSession(indexedDbSessionStorage(), { editor: useEditorStore, library: useLibraryStore, settings: useSettingsStore })
    .catch(() => {})
    .finally(render);
