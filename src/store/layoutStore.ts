import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrawerTab = 'library' | 'slots' | 'monitor' | 'settings';

type LayoutStore = {
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  toggleDrawer(): void;
  closeDrawer(): void;
  /** Shows a Data drawer tab, opening the drawer if needed. */
  showTab(tab: DrawerTab): void;
};

/** Panel layout, kept between sessions. */
export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      drawerOpen: false,
      drawerTab: 'settings',
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      closeDrawer: () => set({ drawerOpen: false }),
      showTab: (drawerTab) => set({ drawerTab, drawerOpen: true }),
    }),
    {
      name: 'chroma-layout',
      partialize: ({ drawerOpen, drawerTab }) => ({ drawerOpen, drawerTab }),
    },
  ),
);
