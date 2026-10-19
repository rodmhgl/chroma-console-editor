import { useEffect } from 'react';
import { virtualPedal } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { ConnectionBar, WebMidiNote } from './ConnectionBar';
import { DataDrawer } from './drawer/DataDrawer';
import { useLayoutScale } from './layoutScale';
import { VirtualPedalView } from './VirtualPedalView';

/** The editor: the connection bar, then the console the Modules will fill, and the Virtual Pedal. */
export function App() {
  const theme = useSettingsStore((s) => s.theme);
  useLayoutScale();
  // app.css themes the page from this.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // The browser's title bar follows the theme's paper.
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
  }, [theme]);

  return (
    <div className="app">
      <ConnectionBar />
      <div className="workspace">
        <main className="main-column">
          <WebMidiNote />
          <section className="console" aria-label="Editor">
            <p className="console-empty">The pedal’s controls will appear here.</p>
          </section>
          <VirtualPedalView pedal={virtualPedal} />
          <footer className="affiliation-notice">
            Unofficial, free and open-source preset editor for the Chroma Console. Not affiliated with or endorsed by
            Hologram Electronics.
          </footer>
        </main>
      </div>
      <DataDrawer />
    </div>
  );
}
