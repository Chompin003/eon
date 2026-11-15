import { openControls } from './controlMenus';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';
const example =
  '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4';

test('a wrong exposure is rejected rather than analyzed under the requested date', async ({
  page,
}) => {
  await page.route('**/examples/spherex/epoch-1.fits', (r) =>
    r.fulfill({
      body: readFileSync('public/examples/spherex/epoch-0.fits'),
      contentType: 'application/fits',
    }),
  );
  await page.goto(example);
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('2 exposiciones analizadas', {
    timeout: 30000,
  });
  await page.getByText('1 exposiciones no analizables', { exact: true }).click();
  await expect(page.getByText('La fecha del FITS no coincide', { exact: false })).toBeVisible();
});

test('cancel stops pixel work and the same region can be analyzed again', async ({ page }) => {
  await page.goto(example);
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await openControls(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let hold = true;
  await page.route('**/examples/spherex/epoch-0.fits', async (route) => {
    if (hold) await gate;
    try {
      await route.fallback();
    } catch {
      /* Worker deliberately terminated. */
    }
  });
  try {
    await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Avance del análisis' })).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Interpretar región', exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId('pixel-summary')).toHaveCount(0);
    hold = false;
    release();
    await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
    await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones analizadas', {
      timeout: 30000,
    });
  } finally {
    release();
  }
});
test('an explicit real example works without archives, detects FITS pixels and exports measurements', async ({
  page,
}) => {
  await page.route('https://**/*', (r) => r.abort());
  await page.goto(example);
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await openControls(page);
  await expect(page.getByTestId('example-notice')).toContainText('Ejemplo real guardado');
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones analizadas', {
    timeout: 30000,
  });
  const marks = page.locator('.detection-markers [data-detection-id]');
  expect(await marks.count()).toBeGreaterThan(2);
  const first = marks.first();
  await first.focus();
  await first.press('Enter');
  await expect(page.getByLabel('Explorar fuente detectada')).not.toHaveValue('');
  await expect(page.getByText('Centroide medido:', { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
  const download = await downloadPromise;
  const json = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  expect(json.method).toBe('SEP 1.4.1');
  expect(json.frames).toHaveLength(3);
  expect(json.frames[0].detections.length).toBeGreaterThan(2);
  expect(
    json.frames[0].detections.every(
      (d: { association: string; category: string }) =>
        d.association !== 'ambiguous' || d.category === 'unknown',
    ),
  ).toBe(true);
  expect(new URL(page.url()).searchParams.get('example')).toBe('ngc1491');
  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
});

test('pixel detections update with dates, preserve Paint and allow jumping to a measured exposure', async ({
  page,
}) => {
  await installArchiveFixtures(page);
  await page.goto(example);
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toBeVisible({ timeout: 30000 });
  const old = await page
    .locator('.detection-markers [data-detection-id]')
    .first()
    .getAttribute('data-detection-id');
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(page.locator('.detection-markers [data-detection-id]').first()).not.toHaveAttribute(
    'data-detection-id',
    old!,
  );
  await page.getByLabel('Explorar fuente detectada').selectOption({ index: 1 });
  await page.getByText('Mediciones y fechas', { exact: true }).click();
  const open = page
    .locator('.measurement-table')
    .getByRole('button', { name: 'Abrir', exact: true })
    .first();
  await open.click();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
  await expect(page.locator('.study-details')).toContainText('Centroide medido');
  await expect(
    page.getByRole('application', { name: 'Anotaciones de estudio: dibuja sobre SPHEREx' }),
  ).toBeVisible();
});

test('opening the example is explicit and never replaces a failed live query', async ({ page }) => {
  await installArchiveFixtures(page);
  await page.route('**/api/observations?**', (r) => r.fulfill({ status: 502 }));
  await page.goto(
    '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  await expect(page.locator('.link-restore-notice')).toContainText('No se pudo restaurar');
  await expect(page.locator('.region-canvas')).toHaveCount(0);
  await openControls(page);
  await page.getByRole('button', { name: 'Abrir ejemplo real · NGC 1491', exact: true }).click();
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await expect(page.getByTestId('example-notice')).toBeVisible();
});
