import { expect, test } from '@playwright/test';

test('the app shows a notice that it is not affiliated with Hologram Electronics, and none of their artwork', async ({ page }) => {
  await page.goto('./');

  await expect(page.getByText(/preset editor for the Chroma Console/i)).toBeVisible();
  await expect(page.getByText(/not affiliated with or endorsed by Hologram Electronics/i)).toBeVisible();
  // Branding: the maker is named only in the notice, and the page shows no images.
  await expect(page.locator('body')).toContainText(/hologram/i);
  expect((await page.locator('body').innerText()).match(/hologram/gi)).toHaveLength(1);
  await expect(page.locator('img, svg, picture')).toHaveCount(0);
});
