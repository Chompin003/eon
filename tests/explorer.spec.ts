import { openControls } from './controlMenus';
import { expect, test } from '@playwright/test';
import { installArchiveFixtures, provenance } from './archiveFixtures';

test.beforeEach(async ({ page }) => {
  await installArchiveFixtures(page);
});

test('real HiPS source has deep zoom, keyboard navigation and exact HMS/DMS targeting', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tileFrames = new Set<string>();
  page.on('request', (request) => {
    const match = request.url().match(/Npix\d+_(\d+)\.png/);
    if (match) tileFrames.add(match[1]);
  });
  await page.goto('/');
  const sky = page.frameLocator('iframe').locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(1);
  await openControls(page);
  await expect(page.getByTestId('control-fov')).toHaveText('10.00°');
  const slider = page.getByRole('slider', { name: 'Zoom', exact: true });
  await slider.press('End');
  await expect(page.getByTestId('control-fov')).toHaveText('1.00″');
  await expect
    .poll(async () => Number(await sky.getAttribute('data-fov')))
    .toBeCloseTo(1 / 3600, 8);
  await slider.press('Home');
  await expect(page.getByTestId('control-fov')).toHaveText('100.00°');
  await page.getByRole('button', { name: 'Restablecer vista' }).click();
  await page.getByLabel('Ascensión recta · H M S').fill('23 59 59.9');
  await page.getByLabel('Declinación · ±D M S').fill('-00 15 30');
  await page.getByRole('button', { name: 'GO', exact: true }).click();
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')))
    .toBeCloseTo(359.9995833333333, 7);
  await expect
    .poll(async () => Number(await sky.getAttribute('data-dec')))
    .toBeCloseTo(-0.25833333333333336, 7);
  await expect(page.getByTestId('control-fov')).toHaveText('10.00°');
  await sky.press('ArrowRight');
  await expect.poll(async () => Number(await sky.getAttribute('data-ra'))).toBeLessThan(359.9);
  await sky.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => tileFrames.has('63')).toBe(true);
  // The hidden second channel is no longer fetched during monochrome startup.
  expect(tileFrames.has('85')).toBe(false);
  expect(errors).toEqual([]);
});

test('two spectra support monochrome overlay, color and synchronized split panes', async ({
  page,
}) => {
  await page.goto('/');
  await openControls(page);
  await expect(page.locator('#spectral-channel option')).toHaveCount(100);
  await expect(page.locator('#spectral-channel option[value="50"]')).toHaveCount(0);
  await page.getByLabel('Superponer A y B en blanco y negro').check();
  await page.getByRole('button', { name: 'Color', exact: true }).click();
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-mode', 'color');
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(2);
  const left = page.locator('iframe').nth(0).contentFrame().locator('#sky');
  const right = page.locator('iframe').nth(1).contentFrame().locator('#sky');
  await expect(left).toHaveAttribute('data-ready', 'true');
  await expect(right).toHaveAttribute('data-ready', 'true');
  await expect(left).toHaveAttribute('data-mode', 'mono');
  await expect(right).toHaveAttribute('data-mode', 'color');
  await right.press('ArrowRight');
  await right.press('+');
  for (const attribute of ['data-ra', 'data-dec', 'data-fov']) {
    await expect
      .poll(async () =>
        Math.abs(
          Number(await left.getAttribute(attribute)) - Number(await right.getAttribute(attribute)),
        ),
      )
      .toBeLessThan(1e-7);
  }
  await page.screenshot({ path: 'test-results/split-controls.png' });
});

test('actual FITS epochs show their year, preserve WCS and survive closing the panel', async ({
  page,
}) => {
  await page.goto('/');
  await openControls(page);
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await expect(page.getByTestId('observation-year')).toHaveText('2025');
  await expect(page.getByTestId('epoch-date')).toContainText('2025-08-22');
  await page.getByRole('button', { name: 'Animar región' }).click();
  let sky = page.locator('.region-canvas');
  await expect(sky).toHaveAttribute('data-source', 'fits');
  // Renderer-derived FITS footprint agrees with an independent Astropy WCS read.
  await expect
    .poll(async () => Number(await sky.getAttribute('data-image-ra')))
    .toBeCloseTo(provenance.sky.ra, 6);
  await expect
    .poll(async () => Number(await sky.getAttribute('data-image-dec')))
    .toBeCloseTo(provenance.sky.dec, 6);
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(page.getByTestId('observation-year')).toHaveText('2026');
  await expect(page.locator('.panel-observation-date')).toContainText('2026');
  sky = page.locator('.region-canvas');
  await expect(sky).toHaveAttribute('data-source', 'fits');
  await expect(page.getByTestId('epoch-date')).toContainText('2026-09-02');
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await openControls(page);
  await expect(page.getByTestId('observation-year')).toHaveText('2026');
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await expect(page.getByTestId('interval')).toHaveText('100 ms');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByTestId('observation-year')).toHaveText('2025');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('button', { name: 'Volver al mosaico' }).click();
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-source', 'hips');
});

test('tool window moves, resizes and remains reachable on a small screen', async ({ page }) => {
  await page.goto('/');
  await openControls(page);
  const panel = page.getByRole('dialog', { name: 'Controles del visor' });
  const original = (await panel.boundingBox())!;
  const handle = (await page
    .getByRole('button', { name: 'Mover panel', exact: true })
    .boundingBox())!;
  await page.mouse.move(handle.x + 100, handle.y + 18);
  await page.mouse.down();
  await page.mouse.move(handle.x + 240, handle.y + 98, { steps: 12 });
  await page.mouse.up();
  const moved = (await panel.boundingBox())!;
  expect(moved.x).toBeGreaterThan(original.x + 100);
  const grip = page.getByRole('button', { name: 'Cambiar tamaño del panel' });
  const gripBox = (await grip.boundingBox())!;
  await page.mouse.move(gripBox.x + 8, gripBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + 90, gripBox.y + 58, { steps: 12 });
  await page.mouse.up();
  expect((await panel.boundingBox())!.width).toBeGreaterThan(moved.width + 50);
  await page.setViewportSize({ width: 390, height: 640 });
  await expect
    .poll(async () => {
      const rect = (await panel.boundingBox())!;
      return rect.x + rect.width;
    })
    .toBeLessThanOrEqual(378);
  const rect = (await panel.boundingBox())!;
  expect(rect.y + rect.height).toBeLessThanOrEqual(628);
});

test('IRSA failure offers a retry and never substitutes a synthetic image', async ({ page }) => {
  await page.route('**/spherex_allsky_cube/properties', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar SPHEREx');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
});

test('mobile touch pan and pinch operate the real sky projection', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await installArchiveFixtures(page);
    await page.goto('/');
    const sky = page.frameLocator('iframe').locator('#sky');
    await expect(sky).toHaveAttribute('data-ready', 'true');
    const initialRa = Number(await sky.getAttribute('data-ra'));
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 130, y: 400, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 190, y: 430, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => Math.abs(Number(await sky.getAttribute('data-ra')) - initialRa))
      .toBeGreaterThan(0.01);
    const initialFov = Number(await sky.getAttribute('data-fov'));
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 120, y: 400, id: 1 },
        { x: 180, y: 400, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 100, y: 400, id: 1 },
        { x: 200, y: 400, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 70, y: 400, id: 1 },
        { x: 230, y: 400, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => Number(await sky.getAttribute('data-fov')))
      .toBeLessThan(initialFov);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth === innerWidth &&
          document.documentElement.scrollHeight === innerHeight,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});
