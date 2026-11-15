import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { openControls } from './controlMenus';
import { installArchiveFixtures } from './archiveFixtures';

const example =
  '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4';
async function analyzeExample(page: Page) {
  await page.goto(example);
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await openControls(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('interpretation-summary')).toContainText(
    '3 exposiciones analizadas',
    { timeout: 30000 },
  );
}
async function reportFile(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar informe JSON', exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toContain('J2000_RA04h03m14.64s_Dec+51d20m25.45s_informe.json');
  return JSON.parse(readFileSync((await file.path())!, 'utf8'));
}

test('real FITS evidence produces a traceable report and reviewing it adds no archive requests', async ({
  page,
}) => {
  await page.route('https://**/*', (r) => r.abort());
  await analyzeExample(page);
  const report = page.getByTestId('interpretation-report');
  await expect(report).toContainText('Ejemplo real guardado');
  await expect(report.getByTestId('report-unassessed')).toContainText(
    'Calidad instrumental, movimiento físico y variabilidad de brillo',
  );
  await expect(report.getByTestId('interpretation-summary')).toContainText(
    '21 detecciones retenidas',
  );
  await report.getByText('Grupos con más fechas medidas', { exact: true }).click();
  await report.locator('.report-group-list button').first().click();
  await expect(page.getByTestId('source-interpretation')).toContainText('3 mediciones en 3 fechas');
  await expect(page.getByLabel('Explorar fuente detectada')).not.toHaveValue('');
  let newRequests = 0;
  page.on('request', (r) => {
    if (/epoch-[0-2]\.fits|\/api\/(catalog|cutout|observations)\?/.test(r.url())) newRequests++;
  });
  const json = await reportFile(page);
  expect(json.method).toBe('eon-evidence-rules-1');
  expect(json.counts).toMatchObject({
    analyzed: 3,
    detections: 21,
    groups: 19,
    multiDateGroups: 1,
  });
  expect(json.selectedGroup.measurements).toBe(3);
  expect(json.catalog.records).toHaveLength(json.catalog.entries);
  expect(json.limits).toMatchObject({
    physicalMotion: 'not-evaluated',
    brightnessVariability: 'not-evaluated',
    instrumentQuality: 'not-evaluated',
    identity: 'not-confirmed',
  });
  expect(
    json.exposures.every((f: { archiveUrl: string }) =>
      f.archiveUrl.startsWith('https://irsa.ipac.caltech.edu/ibe/data/spherex/'),
    ),
  ).toBe(true);
  const sourceReport = page.getByTestId('source-interpretation');
  await sourceReport.locator('summary').click();
  await sourceReport
    .getByRole('button', { name: /^Ver exposición/ })
    .last()
    .click();
  await expect(page.locator('.region-canvas')).toHaveAttribute(
    'data-frame-id',
    json.selectedGroup.evidence.at(-1).frameId,
  );
  const after = await reportFile(page);
  expect(after.counts).toEqual(json.counts);
  expect(after.groups).toEqual(json.groups);
  expect(newRequests).toBe(0);
});

test('catalog-only results stay distinct from pixel detections and report provider failures', async ({
  page,
}) => {
  await installArchiveFixtures(page);
  await page.route('**/api/catalog?**', (route) => {
    const provider = new URL(route.request().url()).searchParams.get('provider');
    return provider === 'gaia'
      ? route.fulfill({ status: 502 })
      : route.fulfill({
          body: readFileSync('tests/fixtures/spherex/simbad-region.json'),
          contentType: 'application/json',
        });
  });
  await page.goto('/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1');
  await openControls(page);
  await page.getByRole('button', { name: 'Consultar solo catálogos', exact: true }).click();
  const report = page.getByTestId('interpretation-report');
  await expect(report).toContainText('Aún no hay mediciones de píxeles');
  await expect(report.locator('[data-rule="catalog-partial"]')).toContainText('incompletos');
  const json = await reportFile(page);
  expect(json.mode).toBe('catalog');
  expect(json.counts.analyzed).toBe(0);
  expect(json.groups).toEqual([]);
  expect(json.catalog.byProvider.gaia).toBe(0);
  expect(json.catalog.errors).toHaveLength(1);
  await expect(report).toContainText('Imágenes pendientes de analizar');
  await expect(report.getByTestId('report-unassessed')).toHaveCount(0);
  await report.getByRole('button', { name: 'Abrir Animación', exact: true }).click();
  await expect(
    page
      .locator('[data-control-menu]')
      .filter({ has: page.locator(':scope > summary strong', { hasText: /^Animación$/ }) }),
  ).toHaveAttribute('open', '');
});

for (const mobile of [false, true])
  test(`preparing images guides the same region from the mosaic to a measured report (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await installArchiveFixtures(page);
    await page.route('**/api/catalog?**', (r) =>
      r.fulfill({
        body: readFileSync(
          'tests/fixtures/spherex/' +
            (new URL(r.request().url()).searchParams.get('provider') === 'gaia'
              ? 'gaia-dr3-region.xml'
              : 'simbad-region.json'),
        ),
        contentType: 'text/plain',
      }),
    );
    await page.goto('/?ra=60.8109955&dec=51.3404038&fov=.075');
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    const analysis = page
      .locator('[data-control-menu]')
      .filter({ has: page.locator(':scope > summary strong', { hasText: /^Análisis$/ }) });
    await analysis.locator(':scope > summary').click();
    await expect(page.getByRole('button', { name: 'Interpretar región', exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole('button', { name: 'Preparar imágenes para analizar', exact: true })
      .press('Enter');
    const animation = page
      .locator('[data-control-menu]')
      .filter({ has: page.locator(':scope > summary strong', { hasText: /^Animación$/ }) });
    await expect(animation).toHaveAttribute('open', '');
    await expect(animation.locator(':scope > summary')).toBeFocused();
    await expect(page.getByLabel('Tamaño de región', { exact: true })).toHaveValue('0.075');
    await page.getByRole('button', { name: 'Buscar exposiciones aquí', exact: true }).click();
    await page.getByRole('button', { name: 'Animar región', exact: true }).click();
    await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
    await expect(page.getByTestId('interpretation-summary')).toContainText(
      '3 exposiciones analizadas',
      { timeout: 30000 },
    );
    await expect(
      page
        .getByTestId('interpretation-report')
        .getByRole('heading', { name: 'Informe de región', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Consultar solo catálogos', exact: true }),
    ).toHaveCount(0);
  });

test('a wrong FITS date is omitted from the report and its evidence, never disguised as a good exposure', async ({
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
  await expect(page.getByTestId('interpretation-summary')).toContainText(
    '2 exposiciones analizadas',
    { timeout: 30000 },
  );
  const json = await reportFile(page);
  expect(json.counts).toMatchObject({ analyzed: 2, failed: 1 });
  expect(json.failures[0].message).toContain('fecha del FITS no coincide');
  expect(json.exposures.map((f: { id: string }) => f.id)).not.toContain(
    '2026W07_2A_0374_3:SPHEREx-D4',
  );
  await expect(
    page.getByTestId('interpretation-report').locator('[data-rule="partial-measurements"]'),
  ).toBeVisible();
});

test('canceling a new analysis never combines its catalogs with previous pixel measurements', async ({
  page,
}) => {
  await analyzeExample(page);
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
      /* Deliberately canceled worker. */
    }
  });
  try {
    await page.getByLabel('Umbral de detección', { exact: true }).fill('6');
    await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Avance del análisis' })).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole('button', { name: 'Cancelar consulta', exact: true }).click();
    await expect(
      page.getByTestId('interpretation-report').locator('[data-rule="stale-input"]'),
    ).toBeVisible();
    const json = await reportFile(page);
    expect(json.mode).toBe('catalog');
    expect(json.counts.analyzed).toBe(0);
    expect(json.selectedGroup).toBeUndefined();
    hold = false;
    release();
    await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
    await expect(page.getByTestId('interpretation-summary')).toContainText(
      '3 exposiciones analizadas',
      { timeout: 30000 },
    );
    const renewed = await reportFile(page);
    expect(renewed.parameters.threshold).toBe(6);
  } finally {
    hold = false;
    release();
  }
});
