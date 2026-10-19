import { useLayoutStore, type DrawerTab } from '../../store/layoutStore';
import { DATA_BUTTON_ID, DATA_DRAWER_ID, DRAWER_PANEL_ID, drawerTabId } from '../domIds';
import { SettingsTab } from './SettingsTab';

const TABS: { id: DrawerTab; label: string }[] = [{ id: 'settings', label: 'Settings' }];

/** A slide-over with the editor's Settings. Inert while closed; Escape closes it. */
export function DataDrawer() {
  const { drawerOpen, drawerTab, showTab, closeDrawer } = useLayoutStore();

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
          </button>
        ))}
        <button type="button" className="drawer-close" aria-label="Close Data drawer" onClick={closeDrawer}>
          ×
        </button>
      </div>
      <div id={DRAWER_PANEL_ID} className="drawer-body" role="tabpanel" aria-labelledby={drawerTabId(drawerTab)}>
        {drawerTab === 'settings' && <SettingsTab />}
      </div>
    </aside>
  );
}
