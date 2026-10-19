import { expect, test, type Page } from '@playwright/test';

// Module Order, the first Pedal Step setting: reordering the Modules sends nothing, shows the Pedal Step on a diagram of
// the pedal, and confirming it restores the Sync Status.

/** The Modules' headings, left to right as the panel shows them, after the shared controls'. */
const moduleHeadings = (page: Page) => page.getByRole('region', { name: 'Editor' }).getByRole('heading', { level: 2 });

const inOrder = (...modules: string[]) => ['Shared controls', ...modules];

test('dragging a Module reorders the panel and shows the Pedal Step, which confirming clears', async ({ page }) => {
  await page.goto('./');
  const connection = page.getByRole('banner', { name: 'Connection' });
  const syncStatus = connection.getByLabel('Sync Status');
  const log = page.getByRole('region', { name: 'Virtual Pedal' }).getByRole('log');
  const moduleOrder = page.getByRole('group', { name: 'Module Order' });

  await connection.getByRole('button', { name: 'Send All' }).click();
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);
  await expect(moduleHeadings(page)).toHaveText(inOrder('Character', 'Movement', 'Diffusion', 'Texture'));
  await expect(moduleOrder.getByRole('status')).toHaveText('Character → Movement → Diffusion → Texture');
  // Marked as a setting MIDI can't reach.
  await expect(moduleOrder.getByText('Pedal Step', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Pedal Steps' })).toHaveCount(0);

  // Drop Texture on Character's column: Texture moves to the front. Aimed at the column's header, which is in view,
  // since scrolling to its centre mid-drag would cancel the drag.
  await page
    .getByRole('button', { name: 'Move Texture' })
    .dragTo(page.getByRole('region', { name: 'Character' }), { targetPosition: { x: 40, y: 20 } });

  await expect(moduleHeadings(page)).toHaveText(inOrder('Texture', 'Character', 'Movement', 'Diffusion'));
  await expect(moduleOrder.getByRole('status')).toHaveText('Texture → Character → Movement → Diffusion');
  await expect(log.getByRole('listitem')).toHaveCount(26);
  await expect(syncStatus).toHaveText('Possibly Stale');

  const steps = page.getByRole('region', { name: 'Pedal Steps' });
  const step = steps.getByRole('group', { name: 'Set the Module Order' });
  const moves = step.getByRole('listitem');
  await expect(moves).toHaveCount(5);
  await expect(moves.nth(0).getByRole('img')).toHaveAccessibleName('Press A + D together');
  await expect(moves.nth(0)).toContainText('to enter FX Setup');
  for (const [i, [button, module]] of (
    [
      ['D', 'Texture'],
      ['A', 'Character'],
      ['B', 'Movement'],
      ['C', 'Diffusion'],
    ] as const
  ).entries()) {
    const move = moves.nth(i + 1);
    await expect(move.getByRole('img')).toHaveAccessibleName(`Tap ${button}`);
    await expect(move).toContainText(`Tap ${button} (${module}).`);
  }

  await step.getByRole('button', { name: 'Done on the pedal' }).click();

  await expect(steps).toHaveCount(0);
  await expect(syncStatus).toHaveText('In Sync');
  await expect(log.getByRole('listitem')).toHaveCount(26);
});

test('the arrow keys move a Module, and undo puts it back without a Pedal Step', async ({ page }) => {
  await page.goto('./');
  const handle = page.getByRole('button', { name: 'Move Character' });

  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(moduleHeadings(page)).toHaveText(inOrder('Character', 'Movement', 'Diffusion', 'Texture'));
  await page.keyboard.press('ArrowRight');
  await expect(moduleHeadings(page)).toHaveText(inOrder('Movement', 'Character', 'Diffusion', 'Texture'));
  await expect(handle).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(moduleHeadings(page)).toHaveText(inOrder('Movement', 'Diffusion', 'Character', 'Texture'));
  await expect(page.getByRole('region', { name: 'Pedal Steps' })).toBeVisible();

  // Each move is its own undo step; back at the order the pedal already has, nothing is left to do on it.
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(moduleHeadings(page)).toHaveText(inOrder('Character', 'Movement', 'Diffusion', 'Texture'));
  await expect(page.getByRole('region', { name: 'Pedal Steps' })).toHaveCount(0);
});
