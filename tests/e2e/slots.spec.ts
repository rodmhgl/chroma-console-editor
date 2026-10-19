import { expect, test } from '@playwright/test';

// Commit (#18) is the only way a Slot becomes known, so recalling a known Slot is covered by the core and store tests
// until it lands; here every Slot is unknown.
test('the Slot Map shows 80 unknown Slots, and recalling one sends its Program Change and makes the Sync Status Unknown', async ({
  page,
}) => {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const syncStatus = connection.getByLabel('Sync Status');
  const drawer = page.getByRole('complementary', { name: 'Data' });
  const log = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log');
  const shared = page.getByRole('region', { name: 'Shared controls' });

  await connection.getByRole('button', { name: 'Send All' }).click();
  await expect(syncStatus).toHaveText('In Sync');
  await shared.getByRole('slider', { name: 'Tilt' }).press('ArrowDown');

  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Slots' }).click();

  for (const bank of ['A', 'B', 'C', 'D']) {
    await expect(drawer.getByRole('region', { name: `Bank ${bank}` }).getByRole('button')).toHaveCount(20);
  }
  await expect(drawer.getByRole('button', { name: /^Recall [A-D]-\d+ · unknown$/ })).toHaveCount(80);

  await drawer.getByRole('button', { name: 'Recall B-14 · unknown' }).click();

  await expect(log.getByRole('listitem').last()).toHaveText('PC 33 → Recall Slot B-14');
  await expect(syncStatus).toHaveText('Unknown');
  await expect(page.getByRole('status').filter({ hasText: 'may not be sounding what these controls show' })).toBeVisible();
  // The Working State stays as it was, edit and all; only the pedal has moved on.
  await expect(shared.getByRole('slider', { name: 'Tilt' })).toHaveAttribute('aria-valuenow', '63');
  // Undo has nothing left: its steps belonged to what the pedal was sounding before.
  await page.keyboard.press('Control+Z');
  await expect(shared.getByRole('slider', { name: 'Tilt' })).toHaveAttribute('aria-valuenow', '63');
  await expect(log.getByRole('listitem').last()).toHaveText('PC 33 → Recall Slot B-14');

  await connection.getByRole('button', { name: 'Send All' }).click();
  await expect(syncStatus).toHaveText('In Sync');
});
