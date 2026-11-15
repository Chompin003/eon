import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installArchiveFixtures } from './archiveFixtures';
test.beforeEach(async ({ page }) => {
  await installArchiveFixtures(page);
});

test('an archive error preserves the requested exposure and retries it without opening the panel', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/observations?**', (route) =>
    fail ? route.fulfill({ status: 502 }) : route.fallback(),
  );
  await page.goto(
    '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2026W07_2A_0374_3%3ASPHEREx-D4',
  );
  await expect(page.locator('.link-restore-notice')).toContainText('No se pudo restaurar');
  await page.waitForTimeout(650);
  expect(new URL(page.url()).searchParams.get('epoch')).toBe('2026W07_2A_0374_3:SPHEREx-D4');
  fail = false;
  await page.getByRole('button', { name: 'Reintentar enlace', exact: true }).click();
  await expect(page.locator('.region-canvas')).toHaveAttribute(
    'data-frame-id',
    '2026W07_2A_0374_3:SPHEREx-D4',
    { timeout: 30000 },
  );
  await expect(page.locator('.link-restore-notice')).toHaveCount(0);
});

test('leaving a pending shared exposure aborts restoration and leaves the mosaic usable', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/observations?**', async (route) => {
    await gate;
    try {
      await route.fulfill({
        body: readFileSync('tests/fixtures/spherex/observations.xml'),
        contentType: 'application/x-votable+xml',
      });
    } catch {
      /* Request was deliberately aborted. */
    }
  });
  try {
    await page.goto(
      '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2026W07_2A_0374_3%3ASPHEREx-D4',
    );
    await expect(page.locator('.link-restore-notice')).toContainText('Restaurando exposición');
    await page.getByRole('button', { name: 'Ver mosaico', exact: true }).click();
    await expect(page.locator('.link-restore-notice')).toHaveCount(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('epoch')).toBeNull();
    release();
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    await expect(page.getByRole('button', { name: 'Buscar exposiciones aquí' })).toBeEnabled();
    await expect(page.locator('.region-canvas')).toHaveCount(0);
  } finally {
    release();
  }
});

test('browser history restores its sky location instead of overwriting it with the previous view', async ({
  page,
}) => {
  await page.goto('/?ra=12&dec=-3&fov=.2');
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await page.evaluate(() => {
    history.pushState({}, '', '?ra=80&dec=22&fov=.1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')), { timeout: 30000 })
    .toBeCloseTo(80, 7);
  await page.goBack();
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')), { timeout: 30000 })
    .toBeCloseTo(12, 7);
  await expect.poll(async () => Number(await sky.getAttribute('data-dec'))).toBeCloseTo(-3, 7);
});
test('shared coordinates override local selection and copy the current location without flooding history', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    localStorage.setItem(
      'eon:last-region:v1',
      JSON.stringify({ longitude: 100, latitude: -20, sizeDeg: 0.1 }),
    );
    const original = history.replaceState.bind(history);
    (window as unknown as { writes: number }).writes = 0;
    history.replaceState = (...args) => {
      (window as unknown as { writes: number }).writes++;
      original(...args);
    };
  });
  await page.goto('/?ra=359.99&dec=-12.5&fov=0.1&band=3&band2=90');
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect.poll(async () => Number(await sky.getAttribute('data-ra'))).toBeCloseTo(359.99, 7);
  const historyLength = await page.evaluate(() => history.length);
  for (let i = 0; i < 15; i++) await sky.press('ArrowRight');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Copiar enlace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).searchParams.get('band')).toBe('3');
  expect(Number(new URL(copied).searchParams.get('ra'))).toBeCloseTo(
    Number(await sky.getAttribute('data-ra')),
    7,
  );
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(await page.evaluate(() => (window as unknown as { writes: number }).writes)).toBeLessThan(
    12,
  );
  await page.goto(copied);
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')), { timeout: 30000 })
    .toBeCloseTo(Number(new URL(copied).searchParams.get('ra')), 7);
});
test('an exposure link restores the exact recorded date paused and preserves its region', async ({
  page,
}) => {
  await page.goto(
    '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&cx=60.8109955&cy=51.3404038&epoch=2026W07_2A_0374_3%3ASPHEREx-D4',
  );
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-frame-id', '2026W07_2A_0374_3:SPHEREx-D4');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await expect(page.getByTestId('observation-year')).toHaveText('2026');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('epoch'))
    .toBe('2026W36_1A_0557_1:SPHEREx-D4');
});
