import { expect, test, type Page } from '@playwright/test';

// Undo and redo by shortcut: a drag is one step, every other edit one step each, and the Virtual Pedal follows.

const pedalOf = (page: Page) => page.getByRole('region', { name: 'Virtual Pedal' });

test('undo returns the Virtual Pedal to the value before a knob drag, and redo restores it', async ({ page }) => {
  await page.goto('./');
  const amount = page.getByRole('region', { name: 'Character' }).getByRole('slider', { name: 'Amount' });
  const pedalAmount = pedalOf(page).getByLabel('Character Amount');

  await expect(pedalAmount).toHaveText('64');
  const box = (await amount.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 60, { steps: 6 });
  await page.mouse.up();
  const dragged = (await amount.getAttribute('aria-valuenow'))!;
  expect(Number(dragged)).toBeGreaterThan(64);
  await expect(pedalAmount).toHaveText(dragged);

  // The whole drag is one step.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(amount).toHaveAttribute('aria-valuenow', '64');
  await expect(pedalAmount).toHaveText('64');

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(amount).toHaveAttribute('aria-valuenow', dragged);
  await expect(pedalAmount).toHaveText(dragged);
});

test('undo steps back one discrete edit at a time: a knob step, an Effect, Engaged/Bypassed', async ({ page }) => {
  await page.goto('./');
  const movement = page.getByRole('region', { name: 'Movement' });
  const pedal = pedalOf(page);
  const mix = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Mix' });

  await mix.press('ArrowDown');
  await mix.press('ArrowDown');
  await movement.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Phaser' }).check();
  await movement.getByRole('switch', { name: 'Engaged' }).click();
  await expect(pedal.getByLabel('Movement Engaged')).toHaveText('Bypassed');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(pedal.getByLabel('Movement Engaged')).toHaveText('Engaged');
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Phaser');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Doubler');
  await expect(movement.getByRole('radio', { name: 'Doubler' })).toBeChecked();
  await expect(pedal.getByLabel('Texture Mix')).toHaveText('125');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(pedal.getByLabel('Texture Mix')).toHaveText('126');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(mix).toHaveAttribute('aria-valuenow', '127');
  await expect(pedal.getByLabel('Texture Mix')).toHaveText('127');
});

test('a Performance Control pressed between edits is never undone or re-sent', async ({ page }) => {
  await page.goto('./');
  const time = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Time' });
  const log = pedalOf(page).getByRole('log').getByRole('listitem');

  await time.press('ArrowUp');
  await page.getByRole('region', { name: 'Performance Controls' }).getByRole('button', { name: 'Tap' }).click();
  await expect(log.last()).toHaveText('CC 93 = 127 → Tap');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(time).toHaveAttribute('aria-valuenow', '64');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(log).toHaveText(['CC 68 = 65 → Diffusion → Time', 'CC 93 = 127 → Tap', 'CC 68 = 64 → Diffusion → Time']);
});

test('a text field keeps ⌘Z for its own text', async ({ page }) => {
  await page.goto('./');
  const tilt = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Tilt' });
  await tilt.press('ArrowUp');
  await expect(tilt).toHaveAttribute('aria-valuenow', '65');

  const drawer = page.getByRole('complementary', { name: 'Data' });
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: /MIDI Monitor/ }).click();
  await drawer.getByText('Raw MIDI (hardware checks)').click();
  const field = drawer.getByRole('form', { name: 'Send CC' }).getByLabel('Value');
  await field.fill('12');
  await field.press('ControlOrMeta+z');

  await expect(tilt).toHaveAttribute('aria-valuenow', '65');
});
