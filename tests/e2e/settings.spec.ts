import { expect, test } from '@playwright/test';

test('a theme recolours the editor and the browser’s title bar at once', async ({ page }) => {
  await page.goto('./');
  const drawer = page.getByRole('complementary', { name: 'Data' });
  const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const themeColor = page.locator('meta[name="theme-color"]');

  expect(await paper()).toBe('rgb(243, 239, 230)');
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Settings' }).click();
  await drawer.getByLabel('Theme').selectOption('Charcoal (dark)');

  await expect.poll(paper).toBe('rgb(42, 45, 46)');
  await expect(themeColor).toHaveAttribute('content', '#2a2d2e');
});

test('UI scale zooms the layout on top of its fit to the window', async ({ page }) => {
  await page.goto('./');
  const drawer = page.getByRole('complementary', { name: 'Data' });
  const layoutScale = () => page.evaluate(() => Number(document.documentElement.style.getPropertyValue('--layout-scale')));

  await expect.poll(layoutScale).toBeGreaterThan(0);
  const before = await layoutScale();
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Settings' }).click();
  await drawer.getByLabel('UI scale').fill('150');

  await expect.poll(layoutScale).toBeCloseTo(before * 1.5);
});

test('Escape closes the Data drawer and hands focus back to the Data button', async ({ page }) => {
  await page.goto('./');
  const data = page.getByRole('button', { name: /^Data/ });
  const drawer = page.getByRole('complementary', { name: 'Data' });

  await data.click();
  await drawer.getByRole('tab', { name: 'Settings' }).focus();
  await page.keyboard.press('Escape');

  await expect(data).toHaveAttribute('aria-expanded', 'false');
  await expect(data).toBeFocused();
});
