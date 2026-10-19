import { expect, test } from '@playwright/test';

// The Character Module: choosing an Effect and moving Amount and Tilt reach the Virtual Pedal as they happen.

test('choosing Howl and dragging Amount reach the Virtual Pedal', async ({ page }) => {
  await page.goto('./');
  const character = page.getByRole('region', { name: 'Character' });
  const pedal = page.getByRole('region', { name: 'Virtual Pedal' });
  const last = pedal.getByRole('log').getByRole('listitem').last();

  const effect = character.getByRole('group', { name: 'Effect' });
  const effects = ['Drive', 'Sweeten', 'Fuzz', 'Howl', 'Swell'];
  await expect(effect.getByRole('radio')).toHaveCount(effects.length);
  for (const [i, name] of effects.entries()) await expect(effect.getByRole('radio').nth(i)).toHaveAccessibleName(name);
  await expect(effect.getByRole('radio', { name: 'Drive' })).toBeChecked();

  await effect.getByRole('radio', { name: 'Howl' }).check();
  await expect(last).toHaveText('CC 16 = 76 → Character → Howl');
  await expect(pedal.getByLabel('Character Effect')).toHaveText('Howl');

  const amount = character.getByRole('slider', { name: 'Amount' });
  await expect(amount).toHaveAttribute('aria-valuenow', '64');
  const box = (await amount.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  const value = Number(await amount.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(64);
  await expect(pedal.getByLabel('Character Amount')).toHaveText(String(value));
  await expect(last).toHaveText(`CC 65 = ${value} → Character → Amount`);
  await expect(pedal.getByLabel('Character Effect')).toHaveText('Howl');
});

test('Tilt steps with the arrow keys and double-click resets it to neutral', async ({ page }) => {
  await page.goto('./');
  const tilt = page.getByRole('region', { name: 'Character' }).getByRole('slider', { name: 'Tilt' });
  const pedalTilt = page.getByRole('region', { name: 'Virtual Pedal' }).getByLabel('Character Tilt');

  await expect(tilt).toHaveAttribute('aria-valuetext', 'neutral');
  await tilt.press('ArrowLeft');
  await expect(tilt).toHaveAttribute('aria-valuenow', '63');
  await expect(tilt).not.toHaveAttribute('aria-valuetext');
  await expect(pedalTilt).toHaveText('63');

  await tilt.dblclick();
  await expect(tilt).toHaveAttribute('aria-valuenow', '64');
  await expect(pedalTilt).toHaveText('64');
});
