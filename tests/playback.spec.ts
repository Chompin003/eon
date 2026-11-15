import { openControls } from './controlMenus';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installArchiveFixtures, provenance } from './archiveFixtures';

test.beforeEach(async ({ page }) => installArchiveFixtures(page));
async function epochs(page: Page) {
  const seen: string[] = [];
  await page.exposeFunction('recordEpoch', (id: string) => seen.push(id));
  const observe = () => {
    const last = new WeakMap<HTMLCanvasElement, string>();
    const changed = () =>
      document.querySelectorAll<HTMLCanvasElement>('.region-canvas').forEach((canvas) => {
        const id = canvas.dataset.frameId;
        if (canvas.dataset.ready === 'true' && id && last.get(canvas) !== id) {
          last.set(canvas, id);
          (window as unknown as { recordEpoch: (id: string) => void }).recordEpoch(id);
        }
      });
    new MutationObserver(changed).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ready', 'data-frame-id'],
    });
  };
  await page.addInitScript(observe);
  await page.evaluate(observe);
  return seen;
}
async function openRegion(page: Page) {
  await page.goto('/');
  await openControls(page);
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Animar región' }).click();
}

test('prepared 2D playback autostarts and repeats without FITS requests or WebGL panes', async ({
  page,
}) => {
  let cutouts = 0,
    navigations = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cutout?')) cutouts++;
  });
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) navigations++;
  });
  await openRegion(page);
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeEnabled();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  expect(cutouts).toBe(3);
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(page.locator('.region-canvas')).toHaveCount(2);
  await expect(page.locator('iframe')).toHaveCount(0);
  const right = page.locator('.region-canvas').nth(1),
    left = page.locator('.region-canvas').nth(0);
  await expect(right).toHaveAttribute('data-ready', 'true');
  const before = { cutouts, navigations },
    seen = await epochs(page);
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => seen.length, { timeout: 15000 }).toBeGreaterThanOrEqual(18);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  expect(new Set(seen)).toEqual(new Set(provenance.exposures.map((e) => e.id)));
  expect({ cutouts, navigations }).toEqual(before);
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(left).toHaveAttribute('data-frame-id', provenance.exposures[2].id);
  await expect(right).toHaveAttribute('data-frame-id', provenance.exposures[2].id);
  await expect(page.getByTestId('epoch-date')).toContainText('2026-09-02');
  await page.screenshot({ path: 'test-results/region-playback.png' });
});

test('a failed date stays explicit while available dates animate; retry reuses successes', async ({
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
  const seen = await epochs(page);
  await openRegion(page);
  await expect(page.getByRole('button', { name: 'Reintentar cuadros' })).toBeVisible();
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-buffered', '2');
  await expect(page.getByTestId('buffer-progress')).toContainText('1 fecha no disponible');
  await expect.poll(() => seen.length).toBeGreaterThanOrEqual(4);
  expect(new Set(seen)).toEqual(new Set([provenance.exposures[0].id, provenance.exposures[2].id]));
  fail = false;
  await page.getByRole('button', { name: 'Reintentar cuadros' }).click();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-prepared', '3');
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-failed', '0');
  expect(provenance.exposures.map((e) => requests.get(e.url))).toEqual([1, 2, 1]);
});

test('a revisit uses the persistent registered-frame cache without another FITS request', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cutout?')) requests++;
  });
  await openRegion(page);
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  expect(requests).toBe(3);
  await page.reload();
  await openControls(page);
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Animar región' }).click();
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  expect(requests).toBe(3);
});

test('SIA overflow recovers time windows and deduplicates boundaries', async ({ page }) => {
  const xml = readFileSync(new URL('./fixtures/spherex/observations.xml', import.meta.url), 'utf8');
  let requests = 0;
  await page.route('**/api/observations?**', async (route) => {
    requests++;
    const p = new URL(route.request().url()).searchParams;
    const overflow = !p.has('start') || Number(p.get('end')) - Number(p.get('start')) > 400;
    await route.fulfill({
      body: overflow ? xml.replace('value="OK"', 'value="OVERFLOW"') : xml,
      contentType: 'application/x-votable+xml',
    });
  });
  await page.goto('/');
  await openControls(page);
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await expect(
    page.getByLabel('Detector de las exposiciones').locator('option:checked'),
  ).toHaveText('D4 · 3 exposiciones');
  expect(requests).toBeGreaterThanOrEqual(4);
});

test('drawn region controls the query footprint, cutout size and square player', async ({
  page,
}) => {
  let radius = 0,
    cutoutSize = 0;
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname === '/api/observations') radius = Number(u.searchParams.get('radius'));
    if (u.pathname === '/api/cutout') cutoutSize = Number(u.searchParams.get('size'));
  });
  await page.goto('/');
  await openControls(page);
  await page.getByRole('button', { name: 'Seleccionar región', exact: true }).click();
  await expect(
    page.getByRole('application', { name: 'Seleccionar región del cielo' }),
  ).toBeVisible();
  await page.mouse.move(660, 450);
  await page.mouse.down();
  await page.mouse.move(820, 610, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Usar esta región', exact: true }).click();
  await expect(page.getByRole('application', { name: 'Seleccionar región del cielo' })).toHaveCount(
    0,
  );
  await expect(page.getByText(/^Región seleccionada:/)).toBeVisible();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  await page.getByRole('button', { name: 'Animar región' }).click();
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true');
  expect(radius).toBeGreaterThan(0.02 / Math.SQRT2);
  expect(radius).toBeLessThan(0.25 / Math.SQRT2);
  expect(cutoutSize).toBeCloseTo(radius * Math.SQRT2 * 1.5, 5);
  const box = (await page.locator('.region-stage').boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
});

test('region annotations remain registered across dates and follow keyboard pan and zoom', async ({
  page,
}) => {
  await openRegion(page);
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').check();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  const canvas = page.locator('.region-canvas'),
    rect = (await canvas.boundingBox())!;
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 10, { steps: 8 });
  await page.mouse.up();
  const path = page.locator('.study-annotations [data-item]');
  await expect(path).toHaveCount(1);
  const original = await path.getAttribute('d');
  await openControls(page);
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(canvas).toHaveAttribute('data-frame-id', provenance.exposures[2].id);
  await expect(path).toHaveAttribute('d', original!);
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').uncheck();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await canvas.press('ArrowRight');
  await expect(path).not.toHaveAttribute('d', original!);
  const fov = Number(await canvas.getAttribute('data-fov'));
  await canvas.press('+');
  expect(Number(await canvas.getAttribute('data-fov'))).toBeLessThan(fov);
  await canvas.press('Home');
  await expect(path).toHaveAttribute('d', original!);
});

test.describe('mobile region navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('keyboard selection/cancel and touch pan/pinch preserve the registered sky', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await openControls(page);
    await page.getByRole('button', { name: 'Seleccionar región', exact: true }).click();
    let selection = page.getByRole('application', { name: 'Seleccionar región del cielo' });
    await selection.press('Escape');
    await expect(selection).toHaveCount(0);
    await expect(page.getByTestId('control-fov')).toHaveText('10.00°');
    await page.getByRole('button', { name: 'Seleccionar región', exact: true }).click();
    selection = page.getByRole('application', { name: 'Seleccionar región del cielo' });
    await expect(selection).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('button', { name: 'Usar esta región' })).toBeEnabled();
    await selection.press('Enter');
    await expect(selection).toHaveCount(0);
    await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
    await page.getByRole('button', { name: 'Animar región' }).click();
    const canvas = page.locator('.region-canvas');
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Cerrar controles' }).click();
    const box = (await canvas.boundingBox())!,
      y = box.y + box.height / 2;
    const beforeRA = Number(await canvas.getAttribute('data-ra'));
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 130, y, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 190, y: y + 20, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => Math.abs(Number(await canvas.getAttribute('data-ra')) - beforeRA))
      .toBeGreaterThan(0.001);
    const beforeFOV = Number(await canvas.getAttribute('data-fov'));
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 130, y, id: 1 },
        { x: 190, y, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 100, y, id: 1 },
        { x: 230, y, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-fov')))
      .toBeLessThan(beforeFOV * 0.8);
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});
