import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installArchiveFixtures, provenance } from './archiveFixtures';

test('the selectable square resizes and moves, blocks normal oversize visibly, then accepts explicit extended mode', async ({
  page,
}) => {
  await installArchiveFixtures(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Seleccionar región', exact: true }).click();
  const selection = page.getByRole('application', { name: 'Seleccionar región del cielo' });
  await expect(selection).toHaveAttribute('aria-busy', 'false');
  await selection.hover();
  await page.mouse.wheel(0, 1200);
  await expect(selection.getByRole('alert')).toContainText('supera el máximo de 15′');
  await expect(selection.getByRole('alert')).toHaveCSS('font-size', '14px');
  await expect(selection.getByRole('button', { name: 'Usar esta región' })).toBeDisabled();
  await selection.getByLabel('Modo ampliado · hasta 60′', { exact: true }).check();
  await expect(selection.getByText('Más cielo, más espera:', { exact: false })).toBeVisible();
  const box = selection.locator('.region-outline'),
    before = (await box.boundingBox())!;
  const corner = selection.getByRole('button', { name: 'Redimensionar esquina se' }),
    rect = (await corner.boundingBox())!;
  await page.mouse.move(rect.x + 12, rect.y + 12);
  await page.mouse.down();
  await page.mouse.move(rect.x + 52, rect.y + 52, { steps: 5 });
  await page.mouse.up();
  const resized = (await box.boundingBox())!;
  expect(resized.width).toBeGreaterThan(before.width + 20);
  await page.mouse.move(resized.x + resized.width / 2, resized.y + resized.height / 2);
  await page.mouse.down();
  await page.mouse.move(resized.x + resized.width / 2 + 35, resized.y + resized.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.up();
  expect((await box.boundingBox())!.x).toBeGreaterThan(resized.x + 20);
  await selection.getByRole('button', { name: 'Usar esta región' }).click();
  await expect(selection).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('wide')).toBe('1');
  expect(Number(new URL(page.url()).searchParams.get('size'))).toBeGreaterThan(0.25);
});

test('a large real cutout animates and is interpreted; the opt-in travels through APIs and shared URLs', async ({
  page,
}) => {
  await installArchiveFixtures(page);
  const wide = readFileSync('tests/fixtures/spherex/wide-epoch.fits');
  await page.route('**/api/cutout?**', (r) =>
    new URL(r.request().url()).searchParams.get('url') === provenance.exposures[0].url
      ? r.fulfill({ body: wide, contentType: 'application/fits' })
      : r.fallback(),
  );
  await page.route('**/api/catalog?**', (r) => {
    const provider = new URL(r.request().url()).searchParams.get('provider');
    return r.fulfill({
      body: readFileSync(
        'public/examples/spherex/' + (provider === 'gaia' ? 'gaia.xml' : 'simbad.json'),
      ),
      contentType: provider === 'gaia' ? 'application/xml' : 'application/json',
    });
  });
  const requested: URL[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) requested.push(new URL(r.url()));
  });
  await page.goto('/?ra=60.8109955&dec=51.3404038&fov=1');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByLabel('Modo ampliado · hasta 60′', { exact: true }).check();
  await page.getByRole('slider', { name: 'Tamaño de región', exact: true }).fill('1');
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Animar región', exact: true }).click();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await expect(page.locator('.sky-notice')).toContainText('60′ de lado');
  await expect(page.locator('.region-canvas')).toHaveAttribute('width', '1000');
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones analizadas', {
    timeout: 30000,
  });
  await expect(page.getByText('Análisis parcial:', { exact: false })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
  const file = await pending,
    result = JSON.parse(readFileSync((await file.path())!, 'utf8'));
  expect(result.region).toMatchObject({ sizeDeg: 1, extended: true });
  expect(
    result.frames.find((f: { frameId: string }) => f.frameId === provenance.exposures[0].id)
      .detections,
  ).toHaveLength(500);
  expect(result.failures).toHaveLength(0);
  for (const path of ['/api/cutout', '/api/catalog', '/api/observations']) {
    const urls = requested.filter((u) => u.pathname === path);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.searchParams.get('extended') === '1')).toBe(true);
  }
  expect(
    Number(requested.find((u) => u.pathname === '/api/cutout')!.searchParams.get('size')),
  ).toBe(1.5);
  await expect.poll(() => new URL(page.url()).searchParams.get('wide')).toBe('1');
  await page.reload();
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.sky-notice')).toContainText('Región ampliada');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await expect(page.getByLabel('Modo ampliado · hasta 60′', { exact: true })).toBeChecked();
  await page.getByLabel('Modo ampliado · hasta 60′', { exact: true }).uncheck();
  await expect(page.locator('.region-canvas')).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Tamaño de región' })).toHaveAttribute(
    'max',
    '0.25',
  );
});

test('angular scale follows real zoom and remains visible on mobile; failed frames warn outside controls', async ({
  page,
  browser,
}) => {
  await page.route('https://**/*', (r) => r.abort());
  await page.goto(
    '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  const scale = page.locator('.angular-scale');
  await expect(scale).toBeVisible();
  const before = Number(await scale.getAttribute('data-arcsec'));
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await canvas.press('+');
  await canvas.press('+');
  await canvas.press('+');
  await expect
    .poll(async () => Number(await scale.getAttribute('data-arcsec')))
    .toBeLessThan(before);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scale).toBeVisible();
  const box = (await scale.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390);
  const failed = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await failed.route('https://**/*', (r) => r.abort());
    await failed.route('**/examples/spherex/epoch-1.fits', (r) => r.fulfill({ status: 404 }));
    await failed.goto(page.url());
    await expect(failed.locator('.sky-notice-error')).toContainText('Animación incompleta');
    await expect(failed.locator('.sky-notice-error')).toHaveCSS('font-size', '14px');
    await expect(failed.getByRole('button', { name: 'Mostrar controles' })).toBeVisible();
  } finally {
    await failed.close();
  }
});
