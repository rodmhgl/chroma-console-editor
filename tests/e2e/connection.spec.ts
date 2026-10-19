import { expect, test, type Page } from '@playwright/test';

const PEDAL_NAME = 'HOLOGRAM Chroma Console MIDI';

type FakeMidi = { plug(id: string, name: string): void; unplug(id: string): void };
type WithFakeMidi = { fakeMidi: FakeMidi; midiRequests: unknown[] };

/** Replaces Web MIDI with fake outputs, which the test hot-plugs with `window.fakeMidi`. */
async function withSimulatedOutputs(page: Page, outputs: { id: string; name: string }[]) {
  await page.addInitScript((initial) => {
    type Port = { id: string; name: string; type: 'output'; state: string; send(): void };
    const port = (id: string, name: string): Port => ({ id, name, type: 'output', state: 'connected', send() {} });
    const access = {
      outputs: new Map(initial.map((p) => [p.id, port(p.id, p.name)])),
      inputs: new Map(),
      onstatechange: null as null | (() => void),
    };
    const requests: unknown[] = [];
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: async (options: unknown) => {
        requests.push(options);
        return access;
      },
    });
    Object.assign(window, {
      midiRequests: requests,
      fakeMidi: {
        plug(id: string, name: string) {
          access.outputs.set(id, port(id, name));
          access.onstatechange?.();
        },
        unplug(id: string) {
          access.outputs.get(id)!.state = 'disconnected';
          access.onstatechange?.();
        },
      },
    });
  }, outputs);
}

const plug = (page: Page, id: string, name: string) =>
  page.evaluate(([id, name]) => (window as unknown as WithFakeMidi).fakeMidi.plug(id!, name!), [id, name]);
const unplug = (page: Page, id: string) => page.evaluate((id) => (window as unknown as WithFakeMidi).fakeMidi.unplug(id), id);

test('selects the pedal’s USB port by name, asking for Web MIDI without SysEx', async ({ page }) => {
  await withSimulatedOutputs(page, [
    { id: 'din', name: 'USB MIDI Interface' },
    { id: 'usb', name: PEDAL_NAME },
  ]);
  await page.goto('./');
  const output = page.getByRole('banner', { name: 'Connection' }).getByLabel('MIDI output');

  await expect(output.locator('option')).toHaveText(['Virtual Pedal', 'USB MIDI Interface', PEDAL_NAME]);
  await expect(output).toHaveValue('usb');
  await expect(page.getByLabel('Connection status')).toHaveText('Connected');
  expect(await page.evaluate(() => (window as unknown as WithFakeMidi).midiRequests)).toEqual([{ sysex: false }]);
});

test('the output list follows hot-plugging, selecting the pedal when it is plugged in', async ({ page }) => {
  await withSimulatedOutputs(page, []);
  await page.goto('./');
  const output = page.getByRole('banner', { name: 'Connection' }).getByLabel('MIDI output');
  await expect(output).toHaveValue('virtual-pedal');

  await plug(page, 'usb', PEDAL_NAME);
  await expect(output.locator('option')).toHaveText(['Virtual Pedal', PEDAL_NAME]);
  await expect(output).toHaveValue('usb');

  await unplug(page, 'usb');
  await expect(output.locator('option')).toHaveText(['Virtual Pedal', '(unplugged)']);
  await expect(page.getByLabel('Connection status')).toHaveText('Disconnected');

  await output.selectOption('Virtual Pedal');
  await expect(page.getByLabel('Connection status')).toHaveText('Connected');
});

test('the Sync Status is Unknown while the selected output is unplugged, and Possibly Stale once it is back', async ({ page }) => {
  await withSimulatedOutputs(page, [{ id: 'usb', name: PEDAL_NAME }]);
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const syncStatus = connection.getByLabel('Sync Status');
  const sendAll = connection.getByRole('button', { name: 'Send All' });

  await expect(connection.getByLabel('MIDI output')).toHaveValue('usb');
  await sendAll.click();
  await expect(syncStatus).toHaveText('In Sync');

  await unplug(page, 'usb');
  await expect(syncStatus).toHaveText('Unknown');
  await expect(sendAll).toBeDisabled();

  await plug(page, 'usb', PEDAL_NAME);
  await expect(syncStatus).toHaveText('Possibly Stale');
  await expect(sendAll).toBeEnabled();
});

test('the MIDI channel is 1 by default, any of 1–16, with a hint on checking it on the pedal', async ({ page }) => {
  await page.goto('./');
  const midiChannel = page.getByRole('banner', { name: 'Connection' }).getByLabel('MIDI channel');

  await expect(midiChannel).toHaveValue('1');
  await expect(midiChannel.locator('option')).toHaveCount(16);
  await expect(midiChannel).toHaveAccessibleDescription(/Global Settings.*TILT/);

  await midiChannel.selectOption('CH 16');
  await expect(midiChannel).toHaveValue('16');
});

test('without Web MIDI, a notice says to use Chrome or Edge and the Virtual Pedal still works', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: undefined }));
  await page.goto('./');

  await expect(page.getByRole('status').filter({ hasText: 'Web MIDI is unavailable' })).toHaveText(/use Chrome or Edge/);
  await expect(page.getByLabel('MIDI output')).toHaveValue('virtual-pedal');
  await expect(page.getByLabel('Connection status')).toHaveText('Connected');
});
