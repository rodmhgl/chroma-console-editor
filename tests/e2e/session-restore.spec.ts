import { expect, test, type Page } from '@playwright/test';

// Session restore: reopening the editor brings back the Working State, Snapshot, Slot Map and Settings, Possibly
// Stale, sending nothing.

/** Runs `change` on the session the editor stored in IndexedDB, resolving the session as it was. */
const storedSession = (page: Page, change?: string) =>
  page.evaluate(
    (change) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open('chroma-session');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('session', 'readwrite').objectStore('session');
          const get = store.get('last');
          get.onsuccess = () => {
            const session = get.result as Record<string, unknown> | undefined;
            if (session && change) store.put(new Function('session', `return ${change}`)(session), 'last');
            resolve(session);
          };
        };
      }),
    change,
  );

test('reloading restores the Working State, Snapshot, Slot Map and Settings, Possibly Stale', async ({ page }) => {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const syncStatus = connection.getByLabel('Sync Status');
  const midiChannel = connection.getByLabel('MIDI channel');
  const shared = page.getByRole('region', { name: 'Shared controls' });
  const mix = shared.getByRole('slider', { name: 'Mix' });
  const snapshot = page.getByRole('region', { name: 'Snapshot A/B' });
  const drawer = page.getByRole('complementary', { name: 'Data' });
  const log = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log').getByRole('listitem');

  await midiChannel.selectOption('CH 07');
  await connection.getByRole('button', { name: 'Send All' }).click();
  await expect(syncStatus).toHaveText('In Sync');
  await snapshot.getByRole('button', { name: 'Take Snapshot' }).click();
  await mix.press('ArrowDown');
  await page.getByRole('region', { name: 'Movement' }).getByRole('group', { name: 'Effect' }).getByRole('radio', { name: 'Phaser' }).check();
  await page.getByRole('button', { name: /^Data/ }).click();
  await drawer.getByRole('tab', { name: 'Settings' }).click();
  await drawer.getByLabel('Theme').selectOption('Charcoal (dark)');
  await drawer.getByLabel('Send All gap').fill('12');

  // Commit (#18) is the only way the editor fills a Slot, so the Slot Map entry goes straight into what was stored.
  await expect.poll(async () => (await storedSession(page))?.settings).toMatchObject({ theme: 'charcoal', sendGapMs: 12 });
  await storedSession(page, `({ ...session, slotMap: { 33: { committed: session.working, presetId: null, name: 'Tape Bloom' } } })`);

  await page.reload();

  await expect(mix).toHaveAttribute('aria-valuenow', '126');
  await expect(page.getByRole('region', { name: 'Movement' }).getByRole('radio', { name: 'Phaser' })).toBeChecked();
  await expect(midiChannel).toHaveValue('7');
  await expect(syncStatus).toHaveText('Possibly Stale');
  await expect(log).toHaveCount(0);

  await expect(drawer.getByLabel('Theme')).toHaveValue('charcoal');
  await expect(drawer.getByLabel('Send All gap')).toHaveValue('12');
  await drawer.getByRole('tab', { name: 'Slots' }).click();
  await expect(drawer.getByRole('button', { name: 'Recall B-14 · Tape Bloom' })).toBeVisible();

  // The Snapshot is the one taken before the edits.
  await page.keyboard.press('ControlOrMeta+b');
  await expect(snapshot.getByLabel('Comparing')).toHaveText('A · Snapshot');
  await expect(mix).toHaveAttribute('aria-valuenow', '127');
  await expect(log).toHaveCount(2);
  await expect(log.nth(0)).toContainText('CC 17 = 10');
  await expect(log.nth(1)).toContainText('CC 70 = 127');
});
