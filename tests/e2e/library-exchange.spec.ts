import { expect, test, type Page } from '@playwright/test';

/** Opens the Library tab in the Data drawer. */
async function openLibrary(page: Page) {
  const drawer = page.getByRole('complementary', { name: 'Data' });
  const toggle = page.getByRole('button', { name: /^Data/ });
  // The drawer stays open across a reload.
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await drawer.getByRole('tab', { name: 'Library' }).click();
  return drawer;
}

/** Saves the Working State as a new Preset. */
async function saveAs(page: Page, name: string) {
  const drawer = page.getByRole('complementary', { name: 'Data' });
  await drawer.getByRole('button', { name: 'Save As…' }).click();
  await drawer.getByLabel('Preset name').fill(name);
  await drawer.getByLabel('Preset name').press('Enter');
  await expect(page.getByRole('banner', { name: 'Connection' }).getByLabel('Working State')).toHaveText(name);
}

test.describe('without folder access', () => {
  // As in Firefox or Safari: no File System Access API, so the Library lives in IndexedDB.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      delete (Window.prototype as { showDirectoryPicker?: unknown }).showDirectoryPicker;
      delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    });
  });

  test('keeps the Library in browser storage and reminds the user to back it up with a Bundle', async ({ page }) => {
    await page.goto('./');
    const mix = page.getByRole('slider', { name: 'Mix' });
    let drawer = await openLibrary(page);

    await expect(drawer.getByText('Browser storage · kept in this browser only')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Choose folder…' })).toHaveCount(0);
    await expect(drawer.getByRole('status', { name: 'Back up your Library' })).toHaveCount(0);

    await mix.press('PageDown');
    const value = await mix.getAttribute('aria-valuenow');
    await saveAs(page, 'Shimmer Tape');

    // A Library only this browser holds asks to be backed up; "Later" puts it off, across a reload too.
    const reminder = drawer.getByRole('status', { name: 'Back up your Library' });
    await expect(reminder).toBeVisible();
    await reminder.getByRole('button', { name: 'Later' }).click();
    await expect(reminder).toHaveCount(0);
    await page.reload();
    drawer = await openLibrary(page);
    await expect(drawer.getByRole('button', { name: 'Open Shimmer Tape' })).toBeVisible();
    await expect(drawer.getByRole('status', { name: 'Back up your Library' })).toHaveCount(0);

    // A Bundle backs up the browser's Library and imports back into it.
    const download = page.waitForEvent('download');
    await drawer.getByRole('button', { name: 'Export Bundle' }).click();
    const bundle = await download;
    expect(bundle.suggestedFilename()).toMatch(/^browser-storage-\d{4}-\d{2}-\d{2}\.ccbundle\.json$/);
    await drawer.getByLabel('Import Preset or Bundle files').setInputFiles(await bundle.path());
    await expect(drawer.getByRole('status', { name: 'Import' })).toContainText('0 added · 1 already in the Library');

    await drawer.getByRole('button', { name: 'New' }).click();
    await drawer.getByRole('button', { name: 'Open Shimmer Tape' }).click();
    await expect(mix).toHaveAttribute('aria-valuenow', value!);
  });
});

test.describe('with a Library folder', () => {
  // As in library.spec.ts: the folder picker hands back a folder in the browser's private file system.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.showDirectoryPicker = async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('My Presets', { create: true });
    });
  });

  test('a Bundle export and import round-trips the Library, asking about Presets already in it', async ({ page }) => {
    await page.goto('./');
    const mix = page.getByRole('slider', { name: 'Mix' });
    const drawer = await openLibrary(page);
    const presets = drawer.getByRole('list', { name: 'Presets' });
    const names = presets.getByRole('button', { name: /^Open/ });
    await drawer.getByRole('button', { name: 'Choose folder…' }).click();

    await mix.press('PageDown');
    const ambienceMix = await mix.getAttribute('aria-valuenow');
    await saveAs(page, 'Ambience');
    await presets.getByRole('button', { name: 'Details of Ambience' }).click();
    await presets.getByRole('form', { name: 'Details of Ambience' }).getByLabel('Tags').fill('pad');
    await presets.getByRole('button', { name: 'OK' }).click();
    await drawer.getByRole('button', { name: 'New' }).click();
    await mix.press('Home');
    await saveAs(page, 'Echo');
    await expect(names).toHaveText(['Ambience', 'Echo']);

    const download = page.waitForEvent('download');
    await drawer.getByRole('button', { name: 'Export Bundle' }).click();
    const bundle = await download;
    expect(bundle.suggestedFilename()).toMatch(/^my-presets-\d{4}-\d{2}-\d{2}\.ccbundle\.json$/);
    const bundlePath = await bundle.path();

    for (const name of ['Ambience', 'Echo']) {
      await presets.getByRole('button', { name: `Delete ${name}` }).click();
      await presets.getByRole('button', { name: `Delete ${name}? Click again` }).click();
    }
    await expect(names).toHaveCount(0);

    const importInput = drawer.getByLabel('Import Preset or Bundle files');
    await importInput.setInputFiles(bundlePath);
    await expect(names).toHaveText(['Ambience', 'Echo']);
    await expect(drawer.getByRole('status', { name: 'Import' })).toContainText('2 added');
    await expect(presets.getByRole('list', { name: 'Tags' }).getByRole('listitem')).toHaveText(['pad']);
    // Each Preset's controls come back too.
    await drawer.getByRole('button', { name: 'Open Ambience' }).click();
    await expect(mix).toHaveAttribute('aria-valuenow', ambienceMix!);

    // Echo changed since the export: importing again skips Ambience and asks about Echo.
    const workingState = page.getByRole('banner', { name: 'Connection' }).getByLabel('Working State');
    await drawer.getByRole('button', { name: 'Open Echo' }).click();
    await expect(mix).toHaveAttribute('aria-valuenow', '0');
    await mix.press('End');
    await expect(workingState).toHaveText('Echo •');
    await drawer.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(workingState).toHaveText('Echo');
    await importInput.setInputFiles(bundlePath);
    const conflict = drawer.getByRole('alertdialog', { name: 'Import conflict' });
    await expect(conflict).toContainText('“Echo” is already in the Library');
    await conflict.getByRole('button', { name: 'Replace' }).click();
    await expect(conflict).toHaveCount(0);
    await expect(drawer.getByRole('status', { name: 'Import' })).toContainText(
      '0 added · 1 replaced · 1 already in the Library',
    );
    await expect(names).toHaveText(['Ambience', 'Echo']);
    // The Working State still holds the edit, now modified from the replaced Preset.
    await expect(workingState).toHaveText('Echo •');
  });

  test('a single Preset exports as its own file', async ({ page }) => {
    await page.goto('./');
    const drawer = await openLibrary(page);
    await drawer.getByRole('button', { name: 'Choose folder…' }).click();
    await saveAs(page, 'Shimmer Tape');

    const download = page.waitForEvent('download');
    await drawer.getByRole('button', { name: 'Export Shimmer Tape' }).click();
    expect((await download).suggestedFilename()).toBe('shimmer-tape.ccpreset.json');
  });

  test('a Clean Preset is refused, naming the pedal, not imported as a Chroma Console one', async ({ page }) => {
    await page.goto('./');
    const drawer = await openLibrary(page);
    await drawer.getByRole('button', { name: 'Choose folder…' }).click();

    const file = { format: 'clean-preset', schemaVersion: 1, id: 'clean-1', name: 'Shimmer', params: {} };
    await drawer.getByLabel('Import Preset or Bundle files').setInputFiles({
      name: 'shimmer.cleanpreset.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });

    const report = drawer.getByRole('status', { name: 'Import' });
    await expect(report).toContainText('0 added');
    await report.getByText('1 import problem').click();
    await expect(report).toContainText('shimmer.cleanpreset.json: This is a Clean Preset, open it in the Clean editor');
    await expect(drawer.getByRole('list', { name: 'Presets' }).getByRole('button', { name: /^Open/ })).toHaveCount(0);
  });
});
