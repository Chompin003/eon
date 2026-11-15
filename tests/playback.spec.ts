import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installArchiveFixtures, provenance } from './archiveFixtures';

test.beforeEach(async ({ page }) => installArchiveFixtures(page));

test('prepared playback repeats without FITS requests or rebuilding either pane', async ({
  page,
}) => {
  let cutouts = 0;
  let navigations = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/cutout?')) cutouts++;
  });
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) navigations++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Ver exposición / centrar recorte' }).click();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  expect(cutouts).toBe(3);
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(2);
  const right = page.locator('iframe').nth(1).contentFrame().locator('#sky');
  await expect(right).toHaveAttribute('data-buffered', '3', { timeout: 30000 });
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  const before = { cutouts, navigations };
  const seen: string[] = [];
  await page.exposeFunction('recordEpoch', (id: string) => seen.push(id));
  await page.evaluate(() => {
    addEventListener('message', (event) => {
      if (event.data?.type === 'sky:ready' && event.data.frameId)
        (window as unknown as { recordEpoch: (id: string) => void }).recordEpoch(
          event.data.frameId,
        );
    });
  });
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => seen.length).toBeGreaterThanOrEqual(18);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  expect(new Set(seen)).toEqual(new Set(provenance.exposures.map((entry) => entry.id)));
  expect({ cutouts, navigations }).toEqual(before);
  const left = page.locator('iframe').nth(0).contentFrame().locator('#sky');
  await expect
    .poll(
      async () =>
        (await left.getAttribute('data-frame-id')) === (await right.getAttribute('data-frame-id')),
    )
    .toBe(true);
  // Date selection must present that exposure in both panes, with no scene replacement.
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(left).toHaveAttribute('data-frame-id', provenance.exposures[2].id);
  await expect(right).toHaveAttribute('data-frame-id', provenance.exposures[2].id);
  await expect(page.getByTestId('epoch-date')).toContainText('2026-09-02');
  expect({ cutouts, navigations }).toEqual(before);
});

test('a failed exposure prevents partial playback and retry reuses successful frames', async ({
  page,
}) => {
  let fail = true;
  const requests = new Map<string, number>();
  await page.route('**/api/cutout?**', async (route) => {
    const input = new URL(route.request().url()).searchParams.get('url')!;
    requests.set(input, (requests.get(input) ?? 0) + 1);
    if (fail && input === provenance.exposures[1].url) await route.fulfill({ status: 404 });
    else await route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Ver exposición / centrar recorte' }).click();
  await expect(page.getByRole('button', { name: 'Reintentar cuadros' })).toBeVisible();
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-buffered', '2');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Reintentar cuadros' }).click();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  expect(provenance.exposures.map((entry) => requests.get(entry.url))).toEqual([1, 2, 1]);
});

test('SIA overflow retrieves smaller time windows and deduplicates their boundaries', async ({
  page,
}) => {
  const xml = readFileSync(new URL('./fixtures/spherex/observations.xml', import.meta.url), 'utf8');
  let requests = 0;
  await page.route('**/api/observations?**', async (route) => {
    requests++;
    const params = new URL(route.request().url()).searchParams;
    const start = Number(params.get('start'));
    const end = Number(params.get('end'));
    const overflow = !params.has('start') || end - start > 400;
    // Deliberately overlapping rows simulate inclusive SIA interval boundaries.
    await route.fulfill({
      body: overflow ? xml.replace('value="OK"', 'value="OVERFLOW"') : xml,
      contentType: 'application/x-votable+xml',
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await expect(
    page.getByLabel('Detector de las exposiciones').locator('option:checked'),
  ).toHaveText('D4 · 3 exposiciones');
  expect(requests).toBeGreaterThanOrEqual(4);
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(page.getByTestId('epoch-date')).toContainText('2026-09-02');
});
