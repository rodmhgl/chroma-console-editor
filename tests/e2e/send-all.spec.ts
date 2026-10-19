import { expect, test } from '@playwright/test';

test('Send All reproduces the Working State on the Virtual Pedal and makes it In Sync', async ({ page }) => {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const pedal = page.getByRole('region', { name: 'Virtual Pedal' });
  const log = pedal.getByRole('log');
  const syncStatus = connection.getByLabel('Sync Status');
  const character = page.getByRole('region', { name: 'Character' });
  const movement = page.getByRole('region', { name: 'Movement' });
  const texture = page.getByRole('region', { name: 'Texture' });
  const shared = page.getByRole('region', { name: 'Shared controls' });

  await expect(syncStatus).toHaveText('Possibly Stale');

  // The Virtual Pedal listens on MIDI channel 1, so edits sent on 5 leave it behind the editor.
  await connection.getByLabel('MIDI channel').selectOption('5');
  await character.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Howl' }).check();
  await texture.getByRole('group', { name: 'Filter style' }).getByRole('radio', { name: 'Highpass' }).check();
  await shared.getByRole('group', { name: 'Capture Routing' }).getByRole('radio', { name: 'Pre-FX' }).check();
  await shared.getByRole('slider', { name: 'Tilt' }).press('ArrowDown');
  await movement.getByRole('slider', { name: 'Drift' }).press('ArrowUp');
  await movement.getByRole('switch', { name: 'Engaged' }).click();
  await expect(syncStatus).toHaveText('Possibly Stale');
  await connection.getByLabel('MIDI channel').selectOption('1');

  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Drive');
  await expect(pedal.getByLabel('Movement Engaged')).toHaveText('Engaged');

  await connection.getByRole('button', { name: 'Send All' }).click();

  await expect(syncStatus).toHaveText('In Sync');
  // The six edits ignored on MIDI channel 5, then Send All's 26 messages: Effects first, Engaged/Bypassed last.
  await expect(log.getByRole('listitem')).toHaveCount(6 + 26);
  await expect(log.getByRole('listitem').nth(6)).toHaveText('CC 16 = 76 → Character → Howl');
  await expect(log.getByRole('listitem').last()).toHaveText('CC 106 = 127 → Texture → Engaged');
  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Howl');
  await expect(pedal.getByLabel('Texture Filter style')).toHaveText('Highpass');
  await expect(pedal.getByLabel('Capture Routing')).toHaveText('Pre-FX');
  await expect(pedal.getByLabel('Character Tilt')).toHaveText('63');
  await expect(pedal.getByLabel('Movement Drift')).toHaveText('1');
  await expect(pedal.getByLabel('Movement Engaged')).toHaveText('Bypassed');

  // A live edit keeps the status it found.
  await shared.getByRole('slider', { name: 'Tilt' }).press('ArrowUp');
  await expect(log.getByRole('listitem').last()).toHaveText('CC 64 = 64 → Character → Tilt');
  await expect(syncStatus).toHaveText('In Sync');
});

test('the Send All shortcut sends everything, and Raw MIDI makes the Sync Status Possibly Stale', async ({ page }) => {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const log = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log');
  const syncStatus = connection.getByLabel('Sync Status');

  await expect(connection.getByRole('button', { name: 'Send All' })).toHaveAttribute('aria-keyshortcuts', 'Control+E');
  await page.keyboard.press('Control+E');
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);

  const drawer = page.getByRole('complementary', { name: 'Data' });
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: /MIDI Monitor/ }).click();
  await drawer.getByText('Raw MIDI (hardware checks)').click();
  const cc = drawer.getByRole('form', { name: 'Send CC' });
  await cc.getByLabel('CC').fill('64');
  await cc.getByLabel('Value').fill('0');
  await cc.getByRole('button', { name: 'Send CC' }).click();
  await expect(syncStatus).toHaveText('Possibly Stale');
});

test('the Send All gap is set in Settings', async ({ page }) => {
  await page.goto('./');
  const drawer = page.getByRole('complementary', { name: 'Data' });
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Settings' }).click();
  const gap = drawer.getByLabel('Send All gap');

  await expect(gap).toHaveValue('5');
  await expect(gap).toHaveAccessibleDescription(/Raise it if the pedal misses some/);
  await gap.fill('20');
  await page.getByRole('banner', { name: 'Connection' }).getByRole('button', { name: 'Send All' }).click();

  await expect(page.getByRole('banner', { name: 'Connection' }).getByLabel('Sync Status')).toHaveText('In Sync');
  await expect(page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log').getByRole('listitem')).toHaveCount(26);
});
