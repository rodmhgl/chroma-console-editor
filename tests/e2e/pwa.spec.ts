import { expect, test } from '@playwright/test';
import { PAGES_URL } from '../../playwright.config';

test.use({ serviceWorkers: 'allow', baseURL: PAGES_URL });

test('serves a manifest that makes the editor installable under the project path', async ({ page, request }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Chroma Console Editor');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(new URL(href!, page.url()).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Chroma Console Editor',
    short_name: 'Chroma',
    display: 'standalone',
    start_url: './',
    scope: './',
    theme_color: '#f3efe6',
    background_color: '#f3efe6',
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, response.url()).href)).ok()).toBe(true);
});

test('the service worker activates, and the editor opens offline with its own fonts', async ({ page, context }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith(PAGES_URL) && !r.url().startsWith('data:')) foreign.push(r.url());
  });

  await page.goto('./');
  // `ready` resolves while the worker may still be activating.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return { scope: registration.scope, state: registration.active?.state };
      }),
    )
    .toEqual({ scope: PAGES_URL, state: 'activated' });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Editor' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
  });
  expect(loaded).toEqual(expect.arrayContaining(['Archivo Variable', 'IBM Plex Mono']));
  expect(foreign).toEqual([]);
});

test('Settings shows the version and whether the browser keeps storage', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Data/ }).click();
  const drawer = page.getByRole('complementary', { name: 'Data' });
  await drawer.getByRole('tab', { name: 'Settings' }).click();
  const app = drawer.getByRole('region', { name: 'App' });
  await expect(app.getByLabel('Version')).toHaveText(/^\d+\.\d+\.\d+/);
  await expect(app.getByLabel('Storage')).toHaveText(/^(Kept|May be cleared by the browser)$/);
  // Not installable in a test browser, and nothing waits to update.
  await expect(app.getByRole('button', { name: 'Install app' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Update available' })).toHaveCount(0);
});
