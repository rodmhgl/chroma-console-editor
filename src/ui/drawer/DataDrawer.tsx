import { useEditorStore } from '../../store/editorStore';
import { useLayoutStore, type DrawerTab } from '../../store/layoutStore';
import { DATA_BUTTON_ID, DATA_DRAWER_ID, DRAWER_PANEL_ID, drawerTabId } from '../domIds';
import { LibraryTab } from './LibraryTab';
import { MidiMonitor } from './MidiMonitor';
import { SettingsTab } from './SettingsTab';
import { SlotsTab } from './SlotsTab';

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'slots', label: 'Slots' },
  { id: 'monitor', label: 'MIDI Monitor' },
  { id: 'settings', label: 'Settings' },
];

/** A slide-over with the Library, the Slot Map, the MIDI Monitor and the editor's Settings. Inert while closed; Escape closes it. */
export function DataDrawer() {
  const { drawerOpen, drawerTab, showTab, closeDrawer } = useLayoutStore();
  const sentCount = useEditorStore((s) => s.sent.length);

  return (
    <aside
      id={DATA_DRAWER_ID}
      className={`data-drawer${drawerOpen ? ' is-open' : ''}`}
      aria-label="Data"
      inert={!drawerOpen}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        // Closing makes the drawer inert, which would drop focus to the page: hand it back to the Data button.
        closeDrawer();
        document.getElementById(DATA_BUTTON_ID)?.focus();
      }}
    >
      <div className="drawer-tabs" role="tablist" aria-label="Data">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={drawerTabId(t.id)}
            aria-selected={drawerTab === t.id}
            aria-controls={DRAWER_PANEL_ID}
            className="drawer-tab"
            onClick={() => showTab(t.id)}
          >
            {t.label}
            {t.id === 'monitor' && sentCount > 0 && <span className="tab-badge">{sentCount}</span>}
          </button>
        ))}
        <button type="button" className="drawer-close" aria-label="Close Data drawer" onClick={closeDrawer}>
          ×
        </button>
      </div>
      <div id={DRAWER_PANEL_ID} className="drawer-body" role="tabpanel" aria-labelledby={drawerTabId(drawerTab)}>
        {drawerTab === 'library' && <LibraryTab />}
        {drawerTab === 'slots' && <SlotsTab />}
        {drawerTab === 'monitor' && <MidiMonitor />}
        {drawerTab === 'settings' && <SettingsTab />}
      </div>
    </aside>
  );
}
