import { expect, test, type Page } from '@playwright/test';

// Snapshot A/B: take a Snapshot, edit, flip between the two by click or key with only what differs sent each time, then
// adopt or discard the Snapshot.

const pedalOf = (page: Page) => page.getByRole('region', { name: 'Virtual Pedal' });
const snapshotOf = (page: Page) => page.getByRole('region', { name: 'Snapshot A/B' });

test('take → edit → flip → adopt: each flip sends only what differs, and adopting makes the Snapshot the Working State', async ({ page }) => {
  await page.goto('./');
  const snapshot = snapshotOf(page);
  const pedal = pedalOf(page);
  const log = pedal.getByRole('log').getByRole('listitem');
  const mix = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Mix' });
  const movement = page.getByRole('region', { name: 'Movement' });
  const comparing = snapshot.getByLabel('Comparing');

  await snapshot.getByRole('button', { name: 'Take Snapshot' }).click();
  await expect(comparing).toHaveText('B · Working State');

  await mix.press('ArrowDown');
  await movement.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Phaser' }).check();
  await expect(log).toHaveCount(2);
  await expect(pedal.getByLabel('Texture Mix')).toHaveText('126');

  // To A: the Snapshot's two differing values, in Send All order, and the screen shows the Snapshot.
  await snapshot.getByRole('button', { name: 'Flip A/B' }).click();
  await expect(comparing).toHaveText('A · Snapshot');
  await expect(log).toHaveCount(4);
  await expect(log.nth(2)).toContainText('CC 17 = 10');
  await expect(log.nth(3)).toContainText('CC 70 = 127');
  await expect(mix).toHaveAttribute('aria-valuenow', '127');
  await expect(movement.getByRole('radio', { name: 'Doubler' })).toBeChecked();
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Doubler');
  // The Snapshot is frozen while it shows: its controls can't even take focus.
  await mix.focus();
  await expect(mix).not.toBeFocused();

  // Back to B by shortcut.
  await page.keyboard.press('ControlOrMeta+b');
  await expect(comparing).toHaveText('B · Working State');
  await expect(log).toHaveCount(6);
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Phaser');
  await expect(pedal.getByLabel('Texture Mix')).toHaveText('126');

  await snapshot.getByRole('button', { name: 'Adopt Snapshot' }).click();
  await expect(snapshot.getByRole('button', { name: 'Flip A/B' })).toHaveCount(0);
  await expect(mix).toHaveAttribute('aria-valuenow', '127');
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Doubler');
  await expect(log).toHaveCount(8);

  // Adopting is one undo step.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(mix).toHaveAttribute('aria-valuenow', '126');
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Phaser');
});

test('the shortcuts take, flip, discard and adopt the Snapshot; discarding while A shows returns to B', async ({ page }) => {
  await page.goto('./');
  const snapshot = snapshotOf(page);
  const time = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Time' });

  // The shortcuts listen once the editor has rendered.
  await expect(snapshot.getByRole('button', { name: 'Take Snapshot' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(snapshot.getByLabel('Comparing')).toHaveText('B · Working State');
  await time.press('ArrowUp');
  await page.keyboard.press('ControlOrMeta+b');
  await expect(snapshot.getByLabel('Comparing')).toHaveText('A · Snapshot');
  await expect(time).toHaveAttribute('aria-valuenow', '64');

  await page.keyboard.press('ControlOrMeta+Backspace');
  await expect(snapshot.getByLabel('Comparing')).toHaveCount(0);
  await expect(time).toHaveAttribute('aria-valuenow', '65');
  await expect(pedalOf(page).getByRole('log').getByRole('listitem').last()).toContainText('CC 68 = 65');

  await page.keyboard.press('ControlOrMeta+k');
  await time.press('ArrowUp');
  await page.keyboard.press('ControlOrMeta+u');
  await expect(snapshot.getByLabel('Comparing')).toHaveCount(0);
  await expect(time).toHaveAttribute('aria-valuenow', '65');
});

test('a flip that changes Module Order warns the comparison isn’t exact for it', async ({ page }) => {
  await page.goto('./');
  const snapshot = snapshotOf(page);

  const warning = snapshot.getByText(/isn’t exact/);
  await snapshot.getByRole('button', { name: 'Take Snapshot' }).click();
  await expect(warning).toHaveCount(0);
  const handle = page.getByRole('button', { name: 'Move Character' });
  await handle.focus();
  await page.keyboard.press('ArrowRight');

  await snapshot.getByRole('button', { name: 'Flip A/B' }).click();
  await expect(warning).toContainText('A and B differ in Module Order');
});
