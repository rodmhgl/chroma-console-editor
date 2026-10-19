import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

/** The window size, in CSS px, the layout is drawn for: at this size it shows at 100%. */
export const LAYOUT_WIDTH = 1280;
export const LAYOUT_HEIGHT = 800;
/** Below this the layout stops shrinking and the window scrolls instead. */
export const MIN_WINDOW = { width: 900, height: 600 };
const MAX_SCALE = 2;

const minScale = Math.min(MIN_WINDOW.width / LAYOUT_WIDTH, MIN_WINDOW.height / LAYOUT_HEIGHT);

/**
 * How far to zoom the whole layout so it fills the window in proportion, following the tighter dimension, then by
 * the UI scale setting (a percentage) on top.
 */
export function layoutScale(width: number, height: number, uiScale = 100): number {
  const fit = Math.min(width / LAYOUT_WIDTH, height / LAYOUT_HEIGHT);
  return Math.min(MAX_SCALE, Math.max(minScale, fit)) * (uiScale / 100);
}

/**
 * Zooms the page to `layoutScale` of the window as it resizes. app.css reads `--layout-scale` and `--layout-min-width`.
 * Browser zoom shrinks the window in CSS px too, so measure it as at launch zoom: otherwise this would undo the user's zoom.
 */
export function useLayoutScale() {
  const uiScale = useSettingsStore((s) => s.uiScale);
  // Kept across UI scale changes: the browser may have been zoomed since launch.
  const launchPixelRatio = useRef(window.devicePixelRatio || 1);
  useEffect(() => {
    const root = document.documentElement;
    // Narrower than the minimum window at the smallest scale, the page scrolls sideways rather than squeezing.
    root.style.setProperty('--layout-min-width', `${MIN_WINDOW.width / minScale}px`);
    const apply = () => {
      const browserZoom = (window.devicePixelRatio || 1) / launchPixelRatio.current;
      const scale = layoutScale(window.innerWidth * browserZoom, window.innerHeight * browserZoom, uiScale);
      root.style.setProperty('--layout-scale', String(scale));
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [uiScale]);
}
