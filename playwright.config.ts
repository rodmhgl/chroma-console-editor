import { defineConfig, devices } from '@playwright/test';

/** pwa.spec.ts serves the build under a project path, as GitHub Pages does. */
export const PAGES_URL = 'http://localhost:4174/chroma-console-editor/';

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // A cached app from an earlier run would hide the build under test. pwa.spec.ts allows them.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The whole suite again under the Pages project path. pwa.spec.ts sets that path itself.
    { name: 'chromium-pages', use: { ...devices['Desktop Chrome'], baseURL: PAGES_URL }, testIgnore: 'pwa.spec.ts' },
  ],
  // Started in order, so the second serves the build the first made.
  webServer: [
    {
      command: 'npm run build && npm run preview -- --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview -- --port 4174 --strictPort --base /chroma-console-editor/',
      url: PAGES_URL,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
