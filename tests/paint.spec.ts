import { expect, test } from '@playwright/test';
import type { SkyProjectionWindow } from '../src/shared';
import { installArchiveFixtures } from './archiveFixtures';

test.beforeEach(async ({ page }) => {
  await installArchiveFixtures(page);
});

test('study annotations preserve sky pixels/navigation, erase partially and follow the real projection', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const sky = page.frameLocator('iframe').locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true');
  const board = page.locator('.study-annotations');
  await expect(board).toHaveCSS('pointer-events', 'none');
  const before = await sky.getAttribute('data-ra');
  const frame = page.frames().find((frame) => frame.url().includes('sky.html'))!;
  const anchor = await frame.evaluate(() =>
    (window as SkyProjectionWindow).spherexProjection!.pixelToWorld(600, 500)!,
  );
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').check();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.mouse.move(600, 500);
  await page.mouse.down();
  await page.mouse.move(1000, 500, { steps: 20 });
  await page.mouse.up();
  await expect(board).toHaveAttribute('data-annotation-count', '1');
  await expect(sky).toHaveAttribute('data-ra', before!);
  await expect(board.locator('[data-item]')).toHaveCount(1);
  const originalPath = await board.locator('[data-item]').getAttribute('d');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Borrador parcial', exact: true }).click();
  await page.getByRole('slider', { name: 'Grosor', exact: true }).fill('50');
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(800, 550, { steps: 10 });
  await page.mouse.up();
  await expect(board.locator('mask')).toHaveCount(1);
  await expect(board.locator('[data-item]')).toHaveCount(1);
  await expect(board.locator('[data-item]')).toHaveAttribute('d', originalPath!);
  await board.press('Control+z');
  await expect(board.locator('mask')).toHaveCount(0);
  await board.press('Control+y');
  await expect(board.locator('mask')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar PNG' }).click();
  expect((await download).suggestedFilename()).toContain('.png');
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').uncheck();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await expect(board).toHaveCSS('pointer-events', 'none');
  await sky.press('ArrowRight');
  await expect(board.locator('[data-item]')).not.toHaveAttribute('d', originalPath!);
  const expected = await frame.evaluate(
    ([ra, dec]) => (window as SkyProjectionWindow).spherexProjection!.worldToPixel(ra, dec)!,
    anchor,
  );
  await expect
    .poll(async () => {
      const path = await board.locator('[data-item]').getAttribute('d');
      const first = path!.match(/^M([^,]+),([^ L]+)/)!;
      return Math.hypot(Number(first[1]) - expected[0], Number(first[2]) - expected[1]);
    })
    .toBeLessThan(1);
  await page.screenshot({ path: 'test-results/paint-on-spherex.png' });
  expect(errors).toEqual([]);
});

test('emojis, imported images and annotations share both spectral panes and survive source changes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.locator('spherex-paint').locator('#emoji-picker > summary').click();
  await page.getByRole('searchbox', { name: 'Buscar emoji' }).fill('cohete');
  await page.getByRole('button', { name: 'Insertar cohete', exact: true }).click();
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(1);
  await page
    .locator('spherex-paint')
    .locator('input[type=file]')
    .setInputFiles('tests/fixtures/spherex/tile-63.png');
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(page.locator('iframe').nth(1).contentFrame().locator('#sky')).toHaveAttribute(
    'data-ready',
    'true',
    { timeout: 30000 },
  );
  await expect(page.locator('.study-annotations')).toHaveCount(2);
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(4);
  await page.getByLabel('Mostrar anotaciones', { exact: true }).uncheck();
  for (const surface of await page.locator('.study-annotations').all()) {
    await expect(surface).toHaveCSS('visibility', 'hidden');
    await expect(surface).toHaveCSS('pointer-events', 'none');
  }
  await page.getByRole('button', { name: 'Blanco y negro', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Animar región' }).click();
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-source', 'fits');
  await expect(page.locator('.study-annotations')).toHaveAttribute('data-annotation-count', '2');
  await page.getByLabel('Mostrar anotaciones', { exact: true }).check();
  await expect(page.locator('.study-annotations')).toHaveCSS('visibility', 'visible');
});
