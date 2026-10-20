import { expect, test, type Page } from '@playwright/test';

// The folder picker can't be driven in a test, so it hands back a folder in the browser's private file
// system: a real FileSystemDirectoryHandle, so the editor's File System Access code runs unchanged.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () =>
      (await navigator.storage.getDirectory()).getDirectoryHandle('My Presets', { create: true });
  });
});

/** A file in the Library folder, parsed. */
async function readPresetFile(page: Page, fileName: string) {
  return page.evaluate(async (name) => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('My Presets');
    return JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text());
  }, fileName);
}

/** The file names in the Library folder. */
async function listFiles(page: Page) {
  return page.evaluate(async () => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('My Presets');
    const names: string[] = [];
    for await (const handle of folder.values()) names.push(handle.name);
    return names.sort();
  });
}

/** Opens the Library tab and picks the test folder. */
async function openLibrary(page: Page) {
  const drawer = page.getByRole('complementary', { name: 'Data' });
  await page.goto('./');
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Library' }).click();
  await drawer.getByRole('button', { name: 'Choose folder…' }).click();
  await expect(drawer.getByText('Folder · My Presets')).toBeVisible();
  return drawer;
}

test('new, edit, save and reopen round-trip the Working State and the Virtual Pedal', async ({ page }) => {
  const drawer = await openLibrary(page);
  const workingState = page.getByRole('banner', { name: 'Connection' }).getByLabel('Working State');
  const character = page.getByRole('region', { name: 'Character' });
  const diffusion = page.getByRole('region', { name: 'Diffusion' });
  const pedal = page.getByRole('region', { name: 'Virtual Pedal' });
  const presets = drawer.getByRole('list', { name: 'Presets' });
  await expect(workingState).toHaveText('Untitled');

  // Edit, then Save: the Working State has no Preset yet, so Save asks for a name.
  await character.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Howl' }).check();
  await character.getByRole('slider', { name: 'Amount' }).press('PageUp');
  await diffusion.getByRole('switch', { name: 'Engaged' }).press('Space');
  await expect(workingState).toHaveText('Untitled •');
  await drawer.getByRole('button', { name: 'Save', exact: true }).click();
  await drawer.getByRole('form', { name: 'Save As' }).getByLabel('Preset name').fill('Shimmer Tape');
  await drawer.getByRole('button', { name: 'OK' }).click();

  await expect(workingState).toHaveText('Shimmer Tape');
  await expect(presets.getByRole('listitem')).toHaveCount(1);
  const amount = Number(await character.getByRole('slider', { name: 'Amount' }).getAttribute('aria-valuenow'));
  expect(amount).toBeGreaterThan(64);
  const file = await readPresetFile(page, 'shimmer-tape.ccpreset.json');
  expect(file).toMatchObject({ format: 'chroma-console-preset', schemaVersion: 3, name: 'Shimmer Tape', notes: '', tags: [] });
  expect(file.params).toMatchObject({ characterEffect: 76, characterAmount: amount, diffusionEngaged: 0 });

  // New starts again from the neutral Preset, warning first that it discards the unsaved edit.
  await character.getByRole('slider', { name: 'Amount' }).press('PageUp');
  await expect(workingState).toHaveText('Shimmer Tape •');
  await drawer.getByRole('button', { name: 'New' }).click();
  await expect(drawer.getByRole('button', { name: 'New: Discard edits? Click again' })).toBeVisible();
  await expect(workingState).toHaveText('Shimmer Tape •');
  await drawer.getByRole('button', { name: 'New: Discard edits? Click again' }).click();
  await expect(workingState).toHaveText('Untitled');
  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Drive');
  await expect(pedal.getByLabel('Character Amount')).toHaveText('64');
  await expect(pedal.getByLabel('Diffusion Engaged')).toHaveText('Engaged');

  // Opening with nothing unsaved needs one click, brings back the saved Working State and sends it.
  await presets.getByRole('button', { name: 'Open Shimmer Tape' }).click();
  await expect(workingState).toHaveText('Shimmer Tape');
  await expect(character.getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Howl' })).toBeChecked();
  await expect(character.getByRole('slider', { name: 'Amount' })).toHaveAttribute('aria-valuenow', String(amount));
  await expect(diffusion.getByRole('switch', { name: 'Engaged' })).not.toBeChecked();
  await expect(pedal.getByLabel('Character Effect', { exact: true })).toHaveText('Howl');
  await expect(pedal.getByLabel('Character Amount')).toHaveText(String(amount));
  await expect(pedal.getByLabel('Diffusion Engaged')).toHaveText('Bypassed');
  await expect(pedal.getByRole('log').getByRole('listitem').last()).toHaveText('CC 106 = 127 → Texture → Engaged');
});

test('opening a Preset over unsaved edits warns first', async ({ page }) => {
  const drawer = await openLibrary(page);
  const workingState = page.getByRole('banner', { name: 'Connection' }).getByLabel('Working State');
  const mix = page.getByRole('slider', { name: 'Mix' });
  const presets = drawer.getByRole('list', { name: 'Presets' });

  await drawer.getByRole('button', { name: 'Save As…' }).click();
  await drawer.getByLabel('Preset name').fill('Glass Choir');
  await drawer.getByRole('button', { name: 'OK' }).click();
  await mix.press('PageDown');
  await expect(workingState).toHaveText('Glass Choir •');

  await presets.getByRole('button', { name: 'Open Glass Choir' }).click();
  const armed = presets.getByRole('button', { name: 'Open Glass Choir: Discard edits? Click again' });
  await expect(armed).toBeVisible();
  await expect(workingState).toHaveText('Glass Choir •');

  await armed.click();
  await expect(workingState).toHaveText('Glass Choir');
  await expect(mix).toHaveAttribute('aria-valuenow', '127');
});

test('details rename a Preset and set its notes and tags; Duplicate copies it; Delete needs a second click', async ({ page }) => {
  const drawer = await openLibrary(page);
  const workingState = page.getByRole('banner', { name: 'Connection' }).getByLabel('Working State');
  const presets = drawer.getByRole('list', { name: 'Presets' });

  await drawer.getByRole('button', { name: 'Save As…' }).click();
  await drawer.getByLabel('Preset name').fill('Shimmer Tape');
  await drawer.getByRole('button', { name: 'OK' }).click();

  await presets.getByRole('button', { name: 'Details of Shimmer Tape' }).click();
  const details = presets.getByRole('form', { name: 'Details of Shimmer Tape' });
  await details.getByLabel('Name').fill('Glass Choir');
  await details.getByLabel('Notes').fill('Expects a Gesture recording on Rate.');
  await details.getByLabel('Tags').fill('pad, ambient');
  await details.getByRole('button', { name: 'OK' }).click();

  await expect(workingState).toHaveText('Glass Choir');
  await expect(presets.getByText('Expects a Gesture recording on Rate.')).toBeVisible();
  await expect(presets.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText(['pad', 'ambient']);
  expect(await listFiles(page)).toEqual(['glass-choir.ccpreset.json']);
  expect(await readPresetFile(page, 'glass-choir.ccpreset.json')).toMatchObject({
    name: 'Glass Choir',
    notes: 'Expects a Gesture recording on Rate.',
    tags: ['pad', 'ambient'],
  });

  await presets.getByRole('button', { name: 'Duplicate Glass Choir' }).click();
  await expect(presets.getByRole('button', { name: 'Open Glass Choir copy' })).toBeVisible();
  expect(await listFiles(page)).toEqual(['glass-choir-copy.ccpreset.json', 'glass-choir.ccpreset.json']);

  await presets.getByRole('button', { name: 'Delete Glass Choir copy' }).click();
  await expect(presets.getByRole('button', { name: 'Delete Glass Choir copy? Click again' })).toBeVisible();
  expect(await listFiles(page)).toEqual(['glass-choir-copy.ccpreset.json', 'glass-choir.ccpreset.json']);
  await presets.getByRole('button', { name: 'Delete Glass Choir copy? Click again' }).click();
  await expect(presets.getByRole('button', { name: 'Open Glass Choir copy' })).toHaveCount(0);
  expect(await listFiles(page)).toEqual(['glass-choir.ccpreset.json']);
});
