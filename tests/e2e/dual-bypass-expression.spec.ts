import { expect, test, type Page } from '@playwright/test';

// The Dual Bypass module set and the expression target, Pedal Step settings: changing either sends nothing, shows its
// Pedal Step on a diagram of the pedal, and confirming it restores the Sync Status.

/** Sends All, so the Sync Status is In Sync, and returns what the tests check against. */
async function inSync(page: Page) {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const syncStatus = connection.getByLabel('Sync Status');
  const log = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log');
  await connection.getByRole('button', { name: 'Send All' }).click();
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);
  return { syncStatus, log, steps: page.getByRole('region', { name: 'Pedal Steps' }) };
}

test('toggling the Dual Bypass module set shows the Pedal Step, holding BYPASS through the taps, which confirming clears', async ({ page }) => {
  const { syncStatus, log, steps } = await inSync(page);
  const dualBypass = page.getByRole('group', { name: 'Dual Bypass' });
  const toggle = (module: string) => dualBypass.getByRole('button', { name: module });

  for (const module of ['Character', 'Movement', 'Diffusion', 'Texture']) await expect(toggle(module)).toHaveAttribute('aria-pressed', 'true');
  await expect(dualBypass.getByText('Pedal Step', { exact: true })).toBeVisible();

  await toggle('Character').click();
  await toggle('Texture').click();

  await expect(toggle('Character')).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle('Movement')).toHaveAttribute('aria-pressed', 'true');
  await expect(log.getByRole('listitem')).toHaveCount(26);
  await expect(syncStatus).toHaveText('Possibly Stale');

  const step = steps.getByRole('group', { name: 'Set the Dual Bypass module set' });
  const moves = step.getByRole('listitem');
  await expect(moves).toHaveCount(7);
  await expect(moves.nth(0).getByRole('img')).toHaveAccessibleName('Press A + D together');
  await expect(moves.nth(1).getByRole('img')).toHaveAccessibleName('Hold BYPASS');
  for (const [i, [button, text]] of (
    [
      ['A', 'Make A (Character) solid: tap it if it is blinking.'],
      ['B', 'Make B (Movement) blink: tap it if it is solid.'],
      ['C', 'Make C (Diffusion) blink: tap it if it is solid.'],
      ['D', 'Make D (Texture) solid: tap it if it is blinking.'],
    ] as const
  ).entries()) {
    const move = moves.nth(i + 2);
    await expect(move.getByRole('img')).toHaveAccessibleName(`Tap ${button} while holding BYPASS`);
    await expect(move).toContainText(text);
  }
  await expect(moves.nth(6)).toContainText('Release BYPASS, then press A and D together to leave FX Setup.');

  await step.getByRole('button', { name: 'Done on the pedal' }).click();

  await expect(steps).toHaveCount(0);
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);
});

test('choosing an expression target shows the Pedal Step, moving the expression pedal then the knob', async ({ page }) => {
  const { syncStatus, log, steps } = await inSync(page);
  const expression = page.getByRole('group', { name: 'Expression target' });
  const target = expression.getByRole('combobox', { name: 'Expression target' });

  await expect(target).toHaveValue('none');
  await expect(expression.getByText('Pedal Step', { exact: true })).toBeVisible();

  await target.selectOption({ label: 'Diffusion Amount' });

  await expect(log.getByRole('listitem')).toHaveCount(26);
  await expect(syncStatus).toHaveText('Possibly Stale');
  const step = steps.getByRole('group', { name: 'Set the expression target' });
  const moves = step.getByRole('listitem');
  await expect(moves).toHaveCount(4);
  await expect(moves.nth(1).getByRole('img')).toHaveAccessibleName('Move expression pedal');
  await expect(moves.nth(2).getByRole('img')).toHaveAccessibleName('Move Diffusion Amount');
  await expect(moves.nth(2)).toContainText('Move the Diffusion Amount knob.');
  await expect(moves.nth(3).getByRole('img')).toHaveAccessibleName('Press A + D together');

  await step.getByRole('button', { name: 'Done on the pedal' }).click();
  await expect(steps).toHaveCount(0);
  await expect(syncStatus).toHaveText('In Sync');

  // Back to none, the step moves no knob.
  await target.selectOption({ label: 'None' });
  await expect(moves).toHaveCount(3);
  await expect(moves.nth(2)).toContainText('Wait 3 seconds without moving a knob');
  await step.getByRole('button', { name: 'Done on the pedal' }).click();
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);
});
