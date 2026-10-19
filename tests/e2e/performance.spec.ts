import { expect, test, type Page } from '@playwright/test';

// Performance Controls and Global Settings sit apart from the editing panel, and each press reaches the Virtual Pedal
// at once without touching the Preset it is sounding.

const pedalOf = (page: Page) => page.getByRole('region', { name: 'Virtual Pedal' });
const lastLogged = (page: Page) => pedalOf(page).getByRole('log').getByRole('listitem').last();

test('Capture, Gesture, Tap and the bypass commands are sent as they are pressed, outside the editing panel', async ({ page }) => {
  await page.goto('./');
  const performance = page.getByRole('region', { name: 'Performance Controls' });
  const last = lastLogged(page);

  await expect(page.getByRole('region', { name: 'Editor' }).getByRole('button', { name: 'Tap' })).toHaveCount(0);

  const capture = performance.getByRole('group', { name: 'Capture' });
  await expect(capture.getByRole('button')).toHaveText(['Record', 'Play', 'Stop/Clear']);
  await capture.getByRole('button', { name: 'Record' }).click();
  await expect(last).toHaveText('CC 82 = 107 → Capture → Record');

  await performance.getByRole('group', { name: 'Gesture' }).getByRole('button', { name: 'Stop/Erase' }).click();
  await expect(last).toHaveText('CC 81 = 127 → Gesture → Stop/Erase');

  const tap = performance.getByRole('button', { name: 'Tap' });
  await tap.click();
  await tap.click();
  await expect(pedalOf(page).getByRole('log').getByRole('listitem')).toHaveText(['CC 82 = 107 → Capture → Record', 'CC 81 = 127 → Gesture → Stop/Erase', 'CC 93 = 127 → Tap', 'CC 93 = 127 → Tap']);

  await performance.getByRole('group', { name: 'Pedal' }).getByRole('button', { name: 'Bypass' }).click();
  await expect(last).toHaveText('CC 91 = 0 → Pedal → Bypass');

  await performance.getByRole('group', { name: 'Dual Bypass' }).getByRole('button', { name: 'Total Bypass' }).click();
  await expect(last).toHaveText('CC 92 = 15 → Dual Bypass → Total Bypass');

  // The Preset the pedal is sounding is untouched.
  await expect(page.getByRole('region', { name: 'Character' }).getByRole('switch', { name: 'Engaged' })).toBeChecked();
  await expect(pedalOf(page).getByLabel('Character Engaged')).toHaveText('Engaged');
});

test('Calibration Level is a Global Setting for every Preset, and the Calibration menu opens from the editor', async ({ page }) => {
  await page.goto('./');
  const global = page.getByRole('region', { name: 'Global Settings' });
  const last = lastLogged(page);

  await expect(global).toContainText('applies to every Preset');
  const level = global.getByRole('group', { name: 'Calibration Level' });
  await expect(level.getByRole('radio')).toHaveCount(4);
  // The pedal can't say which it is on, so none is checked until one is chosen here.
  for (const radio of await level.getByRole('radio').all()) await expect(radio).not.toBeChecked();

  await level.getByRole('radio', { name: 'High', exact: true }).check();
  await expect(last).toHaveText('CC 94 = 79 → Calibration Level → High');
  await expect(level.getByRole('radio', { name: 'High', exact: true })).toBeChecked();

  const menu = global.getByRole('group', { name: 'Calibration menu' });
  await menu.getByRole('button', { name: 'Enter' }).click();
  await expect(last).toHaveText('CC 95 = 127 → Calibration menu → Enter');
  await menu.getByRole('button', { name: 'Exit' }).click();
  await expect(last).toHaveText('CC 95 = 0 → Calibration menu → Exit');
});
