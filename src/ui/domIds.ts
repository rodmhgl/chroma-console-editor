import type { DrawerTab } from '../store/layoutStore';

/** Ids that ARIA references and focus hand-offs look up across components. */
export const DATA_BUTTON_ID = 'data-button';
export const DATA_DRAWER_ID = 'data-drawer';
export const DRAWER_PANEL_ID = 'drawer-panel';
export const drawerTabId = (tab: DrawerTab) => `drawer-tab-${tab}`;
