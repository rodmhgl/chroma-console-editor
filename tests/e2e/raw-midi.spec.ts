import { expect, test } from '@playwright/test';

// Raw MIDI sends any CC or Program Change exactly as typed, for the hardware checks; the MIDI Monitor describes it.

test('Raw MIDI sends a CC and a Program Change on the selected MIDI channel, and the MIDI Monitor describes them', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('banner', { name: 'Connection' }).getByLabel('MIDI channel').selectOption('CH 05');
  const drawer = page.getByRole('complementary', { name: 'Data' });
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: /MIDI Monitor/ }).click();
  const monitor = drawer.getByRole('log', { name: 'Outgoing MIDI' });
  await expect(drawer.getByText('Send a message to see it here.')).toBeVisible();
  await drawer.getByText('Raw MIDI (hardware checks)').click();

  const cc = drawer.getByRole('form', { name: 'Send CC' });
  await cc.getByLabel('CC').fill('16');
  await cc.getByLabel('Value').fill('76');
  await cc.getByRole('button', { name: 'Send CC' }).click();
  await expect(monitor.getByRole('listitem').first()).toContainText(/CC\s*16\s*76\s*Character → Howl/);
  await expect(drawer.getByRole('tab', { name: /MIDI Monitor/ })).toContainText('1');

  const pc = drawer.getByRole('form', { name: 'Send Program Change' });
  await pc.getByLabel('Program').fill('33');
  await pc.getByRole('button', { name: 'Send PC' }).click();
  await expect(monitor.getByRole('listitem').first()).toContainText(/PC\s*33\s*Recall Slot B-14/);

  // Both went out on MIDI channel 5, which the Virtual Pedal (on 1) ignores.
  const pedalLog = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log');
  await expect(pedalLog.getByRole('listitem')).toHaveText([
    'CC 16 = 76 on MIDI channel 5 → ignored (pedal listens on MIDI channel 1)',
    'PC 33 on MIDI channel 5 → ignored (pedal listens on MIDI channel 1)',
  ]);

  await drawer.getByRole('button', { name: 'Clear' }).click();
  await expect(monitor).toHaveCount(0);
});
