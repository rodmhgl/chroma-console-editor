import { create } from 'zustand';

/** The palettes the editor can be shown in, each named for the Settings tab. */
export const THEMES = {
  light: 'Paper',
  charcoal: 'Charcoal (dark)',
} as const;

export type Theme = keyof typeof THEMES;

export function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && Object.hasOwn(THEMES, v);
}

/** The editor's own settings that only the UI reads: none of them is sent to the pedal. */
export type UiSettings = {
  theme: Theme;
  /** Percent, on top of the layout's own fit to the window. */
  uiScale: number;
};

export const UI_SCALE_RANGE = { min: 75, max: 200 };

export const DEFAULT_UI_SETTINGS: UiSettings = { theme: 'light', uiScale: 100 };

/** Just the UI settings of `s`, such as the settings store's state or a stored session's Settings. */
export function uiSettingsOf({ theme, uiScale }: UiSettings): UiSettings {
  return { theme, uiScale };
}

type SettingsStore =UiSettings & { update(change: Partial<UiSettings>): void };

export function createSettingsStore() {
  return create<SettingsStore>((set) => ({
    ...DEFAULT_UI_SETTINGS,
    update: (change) => set(change),
  }));
}

export const useSettingsStore = createSettingsStore();
