import { useEffect } from 'react';
import { useEditorStore, virtualPedal } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { ConnectionBar, SyncUnknownNote, WebMidiNote } from './ConnectionBar';
import { DataDrawer } from './drawer/DataDrawer';
import { useLayoutScale } from './layoutScale';
import { Modules } from './panels/ModuleColumn';
import { PedalStepsPanel } from './panels/PedalStepsPanel';
import { PerformancePanel } from './panels/PerformancePanel';
import { SharedControls } from './panels/SharedControls';
import { SnapshotBar } from './panels/SnapshotBar';
import { useShortcuts } from './useShortcuts';
import { VirtualPedalView } from './VirtualPedalView';

/**
 * The editor: the connection bar, then Snapshot A/B and the console of shared controls and Modules (not editable while
 * the Snapshot shows), any Pedal Steps waiting to be done, the Performance Controls and Global Settings apart from the
 * console, and the Virtual Pedal.
 */
export function App() {
  const theme = useSettingsStore((s) => s.theme);
  const showingSnapshot = useEditorStore((s) => s.editor.snapshot?.showing ?? false);
  useLayoutScale();
  useShortcuts();
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
          <SyncUnknownNote />
          <SnapshotBar />
          <section className="console" aria-label="Editor" inert={showingSnapshot}>
            <SharedControls />
            <Modules />
          </section>
          <PedalStepsPanel />
          <PerformancePanel />
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
