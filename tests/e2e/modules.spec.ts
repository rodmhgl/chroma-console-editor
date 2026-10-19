import { expect, test, type Locator, type Page } from '@playwright/test';

// The four Modules and the shared controls: every edit reaches the Virtual Pedal as it happens, and each control reads
// in the pedal's own terms for the Effect selected.

const pedalOf = (page: Page) => page.getByRole('region', { name: 'Virtual Pedal' });
const lastLogged = (page: Page) => pedalOf(page).getByRole('log').getByRole('listitem').last();

test('choosing Howl and dragging Amount reach the Virtual Pedal', async ({ page }) => {
  await page.goto('./');
  const character = page.getByRole('region', { name: 'Character' });
  const pedal = pedalOf(page);
  const last = lastLogged(page);

  const effect = character.getByRole('group', { name: 'Effect' });
  const effects = ['Drive', 'Sweeten', 'Fuzz', 'Howl', 'Swell'];
  await expect(effect.getByRole('radio')).toHaveCount(effects.length);
  for (const [i, name] of effects.entries()) await expect(effect.getByRole('radio').nth(i)).toHaveAccessibleName(name);
  await expect(effect.getByRole('radio', { name: 'Drive' })).toBeChecked();

  await effect.getByRole('radio', { name: 'Howl' }).check();
  await expect(last).toHaveText('CC 16 = 76 → Character → Howl');
  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Howl');

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
  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Howl');

  // Holding ⇧ moves it far less for the same drag.
  await page.keyboard.down('Shift');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  const fine = Number(await amount.getAttribute('aria-valuenow'));
  expect(fine - value).toBeGreaterThan(0);
  expect(fine - value).toBeLessThan(value - 64);
});

test('Sensitivity, a Character Secondary Control, reads neutral at centre and resets there on double-click', async ({ page }) => {
  await page.goto('./');
  const sensitivity = page.getByRole('region', { name: 'Character' }).getByRole('slider', { name: 'Sensitivity' });

  await expect(sensitivity).toHaveAttribute('aria-valuetext', 'neutral');
  await sensitivity.press('PageUp');
  await expect(sensitivity).toHaveAttribute('aria-valuetext', '+16%');
  await expect(lastLogged(page)).toHaveText('CC 72 = 74 → Character → Sensitivity');

  await sensitivity.dblclick();
  await expect(sensitivity).toHaveAttribute('aria-valuetext', 'neutral');
  await expect(lastLogged(page)).toHaveText('CC 72 = 64 → Character → Sensitivity');
});

test('under Pitch, the Movement Rate reads in octaves, and Drift is sent', async ({ page }) => {
  await page.goto('./');
  const movement = page.getByRole('region', { name: 'Movement' });
  const rate = page.getByRole('region', { name: 'Shared controls' }).getByRole('slider', { name: 'Rate' });

  await expect(rate).toHaveAttribute('aria-valuetext', '50%');
  await expect(rate).toHaveAccessibleDescription('doubling time');

  await movement.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Pitch' }).check();
  await expect(lastLogged(page)).toHaveText('CC 17 = 98 → Movement → Pitch');
  await expect(rate).toHaveAttribute('aria-valuetext', '0 oct');
  await expect(rate).toHaveAccessibleDescription('pitch');

  await rate.press('End');
  await expect(rate).toHaveAttribute('aria-valuetext', '+1 oct');
  await expect(lastLogged(page)).toHaveText('CC 66 = 127 → Movement → Rate');
  await expect(pedalOf(page).getByLabel('Movement Rate')).toHaveText('127');

  const drift = movement.getByRole('slider', { name: 'Drift' });
  await expect(drift).toHaveAttribute('aria-valuetext', '0%');
  await drift.press('ArrowUp');
  await expect(lastLogged(page)).toHaveText('CC 74 = 1 → Movement → Drift');
});

test('Diffusion’s Amount and Effect Vol take the arrow keys', async ({ page }) => {
  await page.goto('./');
  const diffusion = page.getByRole('region', { name: 'Diffusion' });

  await diffusion.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Space' }).check();
  await expect(lastLogged(page)).toHaveText('CC 18 = 54 → Diffusion → Space');

  await diffusion.getByRole('slider', { name: 'Amount' }).press('ArrowDown');
  await expect(lastLogged(page)).toHaveText('CC 69 = 63 → Diffusion → Amount');

  const effectVol = diffusion.getByRole('slider', { name: 'Effect Vol' });
  await effectVol.press('Home');
  await expect(effectVol).toHaveAttribute('aria-valuetext', '−100%');
  await expect(lastLogged(page)).toHaveText('CC 77 = 0 → Diffusion → Effect Vol');
});

test('Texture’s Amount turns with the mouse wheel', async ({ page }) => {
  await page.goto('./');
  const texture = page.getByRole('region', { name: 'Texture' });

  await texture.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Interference' }).check();
  await expect(lastLogged(page)).toHaveText('CC 19 = 98 → Texture → Interference');

  const amount = texture.getByRole('slider', { name: 'Amount' });
  await amount.hover();
  await page.mouse.wheel(0, -100);
  await expect(amount).toHaveAttribute('aria-valuenow', '65');
  await expect(lastLogged(page)).toHaveText('CC 71 = 65 → Texture → Amount');

  await texture.getByRole('slider', { name: 'Effect Vol' }).press('ArrowRight');
  await expect(lastLogged(page)).toHaveText('CC 79 = 65 → Texture → Effect Vol');
});

test('Tilt, Time, Mix and Output Level on the shared strip', async ({ page }) => {
  await page.goto('./');
  const shared = page.getByRole('region', { name: 'Shared controls' });
  const tilt = shared.getByRole('slider', { name: 'Tilt' });

  await expect(tilt).toHaveAttribute('aria-valuetext', 'neutral');
  await tilt.press('ArrowLeft');
  await expect(tilt).toHaveAttribute('aria-valuenow', '63');
  await expect(tilt).toHaveAttribute('aria-valuetext', '−2%');
  await expect(pedalOf(page).getByLabel('Character Tilt')).toHaveText('63');
  await tilt.dblclick();
  await expect(tilt).toHaveAttribute('aria-valuenow', '64');
  await expect(pedalOf(page).getByLabel('Character Tilt')).toHaveText('64');

  await shared.getByRole('slider', { name: 'Time' }).press('ArrowUp');
  await expect(lastLogged(page)).toHaveText('CC 68 = 65 → Diffusion → Time');

  const mix = shared.getByRole('slider', { name: 'Mix' });
  await expect(mix).toHaveAttribute('aria-valuetext', '100%');
  await mix.press('Home');
  await expect(lastLogged(page)).toHaveText('CC 70 = 0 → Texture → Mix');
  await mix.dblclick();
  await expect(mix).toHaveAttribute('aria-valuetext', '100%');

  await shared.getByRole('slider', { name: 'Output Level' }).press('ArrowDown');
  await expect(lastLogged(page)).toHaveText('CC 78 = 63 → Output Level');
});

test('bypassing a Module keeps its Effect and greys it out; Engaging it again lights it', async ({ page }) => {
  await page.goto('./');
  const movement = page.getByRole('region', { name: 'Movement' });
  const engaged = movement.getByRole('switch', { name: 'Engaged' });
  const pedal = pedalOf(page);

  await movement.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Phaser' }).check();
  await expect(engaged).toBeChecked();
  await expect(movement).not.toHaveClass(/is-bypassed/);

  await engaged.click();
  await expect(lastLogged(page)).toHaveText('CC 104 = 0 → Movement → Bypassed');
  await expect(engaged).not.toBeChecked();
  await expect(engaged).toHaveText('Bypassed');
  await expect(movement).toHaveClass(/is-bypassed/);
  await expect(movement.getByRole('radio', { name: 'Phaser' })).toBeChecked();
  await expect(pedal.getByLabel('Movement Engaged')).toHaveText('Bypassed');
  await expect(pedal.getByLabel('Movement Effect', { exact: true })).toHaveText('Phaser');
  await expect(page.getByRole('region', { name: 'Character' })).not.toHaveClass(/is-bypassed/);

  await engaged.press('Space');
  await expect(lastLogged(page)).toHaveText('CC 104 = 127 → Movement → Engaged');
  await expect(engaged).toBeChecked();
  await expect(movement).not.toHaveClass(/is-bypassed/);
});

test('the selected Effect and the Engaged light take its Effect Colour; the card keeps its Module Colour', async ({ page }) => {
  await page.goto('./');
  const character = page.getByRole('region', { name: 'Character' });
  const movement = page.getByRole('region', { name: 'Movement' });
  const style = (locator: Locator, property: 'backgroundColor' | 'borderTopColor' | 'filter') =>
    locator.evaluate((el, p) => getComputedStyle(el)[p], property);
  const selected = (module: Locator) => module.getByRole('group', { name: 'Effect' }).locator('label.is-active');
  const light = (module: Locator) => module.locator('.engaged-switch-light');

  // Doubler is red on the pedal, like Drive, though Movement's knobs are yellow.
  const red = await style(selected(character), 'backgroundColor');
  expect(await style(selected(movement), 'backgroundColor')).toBe(red);
  expect(await style(light(movement), 'backgroundColor')).toBe(red);
  const border = await style(movement, 'borderTopColor');
  expect(border).not.toBe(red);

  await movement.getByRole('radio', { name: 'Vibrato' }).check();
  const yellow = await style(selected(movement), 'backgroundColor');
  expect(yellow).not.toBe(red);
  expect(await style(light(movement), 'backgroundColor')).toBe(yellow);
  expect(await style(movement, 'borderTopColor')).toBe(border);

  // Bypassed, the light goes out but the Effect picker keeps its colour, dimmed rather than greyed.
  await movement.getByRole('switch', { name: 'Engaged' }).click();
  await expect(movement).toHaveClass(/is-bypassed/);
  expect(await style(light(movement), 'backgroundColor')).not.toBe(yellow);
  expect(await style(movement.getByRole('group', { name: 'Effect' }), 'filter')).toBe('none');
  expect(await style(selected(movement), 'backgroundColor')).toBe(yellow);

  // Only the Effect picker keeps its colour: Texture's Filter style greys out with the rest of the card.
  const texture = page.getByRole('region', { name: 'Texture' });
  await texture.getByRole('switch', { name: 'Engaged' }).click();
  await expect(texture).toHaveClass(/is-bypassed/);
  expect(await style(texture.getByRole('group', { name: 'Effect' }), 'filter')).toBe('none');
  expect(await style(texture.getByRole('group', { name: 'Filter style' }), 'filter')).toBe('grayscale(1)');
});

test('Filter style sits with Texture and Capture Routing with the shared controls', async ({ page }) => {
  await page.goto('./');
  const filterStyle = page.getByRole('region', { name: 'Texture' }).getByRole('group', { name: 'Filter style' });
  const pedal = pedalOf(page);

  await expect(filterStyle.getByRole('radio', { name: 'Tilt' })).toBeChecked();
  await filterStyle.getByRole('radio', { name: 'Lowpass' }).check();
  await expect(lastLogged(page)).toHaveText('CC 84 = 21 → Filter style → Lowpass');
  await expect(pedal.getByLabel('Texture Filter style')).toHaveText('Lowpass');
  await filterStyle.getByRole('radio', { name: 'Highpass' }).check();
  await expect(lastLogged(page)).toHaveText('CC 84 = 107 → Filter style → Highpass');

  const capture = page.getByRole('region', { name: 'Shared controls' }).getByRole('group', { name: 'Capture Routing' });
  await expect(capture.getByRole('radio', { name: 'Post-FX' })).toBeChecked();
  await capture.getByRole('radio', { name: 'Pre-FX' }).check();
  await expect(lastLogged(page)).toHaveText('CC 83 = 127 → Capture Routing → Pre-FX');
  await expect(pedal.getByLabel('Capture Routing')).toHaveText('Pre-FX');
});
