import { openControls } from './controlMenus';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';
test.beforeEach(async ({ page }) => {
  await installArchiveFixtures(page);
  await page.route('**/api/catalog?**', (route) => {
    const provider = new URL(route.request().url()).searchParams.get('provider');
    return route.fulfill({
      body: readFileSync(
        `tests/fixtures/spherex/${provider === 'gaia' ? 'gaia-dr3-region.xml' : 'simbad-region.json'}`,
      ),
      contentType: provider === 'gaia' ? 'application/x-votable+xml' : 'application/json',
    });
  });
});
test('real catalog classes are explicit, missing astrometry stays unknown and markers follow the sky', async ({
  page,
}) => {
  await page.goto('/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1');
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('study-count')).toContainText('entradas catalogadas');
  const marks = page.locator('.study-markers [data-object-id]');
  expect(await marks.count()).toBeGreaterThan(30);
  const gaia = page.locator('.study-markers [data-provider="Gaia DR3"]').first();
  const before = await gaia.getAttribute('transform');
  await sky.press('ArrowRight');
  await expect(gaia).not.toHaveAttribute('transform', before!);
  await page.getByLabel('Explorar entradas').selectOption('simbad:NGC  1491');
  await expect(page.locator('.study-details')).toContainText('HII Region');
  await expect(page.locator('.study-details')).toContainText('posición de catálogo fija');
  await expect(page.locator('.study-details')).not.toContainText('Probabilidad publicada');
  await page.getByLabel('Mostrar identificaciones').uncheck();
  await expect(page.locator('.study-markers')).toHaveCount(0);
});
test('a failed catalog stays explicit while the other provider remains useful', async ({
  page,
}) => {
  await page.route('**/api/catalog?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('provider') === 'gaia')
      return route.fulfill({ status: 502 });
    return route.fallback();
  });
  await page.goto('/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1');
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Gaia DR3 no está disponible');
  await expect(page.getByTestId('study-count')).toContainText('entradas catalogadas');
  await expect(page.locator('.study-markers [data-provider="Gaia DR3"]')).toHaveCount(0);
});
test('catalog marks stay with a changing epoch and never turn playback into network analysis', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/catalog?')) requests++;
  });
  await page.goto(
    '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('study-count')).toBeVisible();
  const marker = page.locator('.study-markers [data-provider="Gaia DR3"]').first();
  await expect(page.getByTestId('pixel-summary')).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Mostrar identificaciones').check();
  const before = await marker.getAttribute('transform');
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(marker).not.toHaveAttribute('transform', before!);
  expect(requests).toBe(2);
  await expect(canvas).toHaveAttribute('data-frame-id', '2026W36_1A_0557_1:SPHEREx-D4');
});
