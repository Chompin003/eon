/* global process, console, window, document, performance, MutationObserver */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const base = process.env.EON_VERIFY_URL ?? 'http://127.0.0.1:4174';
const output = process.env.EON_REPORT_OUTPUT ?? 'output/interpretation';
const live = process.env.EON_REPORT_LIVE === '1';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    base +
      (live
        ? '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.05'
        : '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4'),
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const menu = (title) =>
    page
      .locator('[data-control-menu]')
      .filter({
        has: page.locator(':scope > summary strong', { hasText: new RegExp('^' + title + '$') }),
      })
      .locator(':scope > summary');
  if (live) {
    await menu('Animación').click();
    await page.getByLabel('Año de búsqueda').selectOption('2025');
    await page.getByRole('button', { name: 'Buscar exposiciones aquí', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Animar región', exact: true })).toBeVisible({
      timeout: 90000,
    });
    await page.getByRole('button', { name: 'Animar región', exact: true }).click();
  }
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
    timeout: 120000,
  });
  if (await page.getByRole('button', { name: 'Pausar', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await menu('Análisis').click();
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toBeVisible({ timeout: 180000 });
  await expect(page.getByTestId('interpretation-summary')).toContainText('detecciones retenidas', {
    timeout: 10000,
  });
  const grip = page.getByRole('button', { name: 'Cambiar tamaño del panel' });
  for (let i = 0; i < 12; i++) await grip.press('Shift+ArrowDown');
  const report = page.getByTestId('interpretation-report');
  await report.scrollIntoViewIfNeeded();
  await report.screenshot({
    path: process.env.EON_REPORT_SCREENSHOT ?? join(output, 'report.png'),
  });
  await report.getByText('Grupos con más fechas medidas', { exact: true }).click();
  if (await report.locator('.report-group-list button').count()) {
    await report.locator('.report-group-list button').first().click();
    await report.getByText('Grupos con más fechas medidas', { exact: true }).click();
    await page
      .getByTestId('source-interpretation')
      .screenshot({ path: join(output, 'source.png') });
  }
  let extraFitsRequests = 0,
    extraCatalogRequests = 0;
  page.on('request', (r) => {
    if (/epoch-[0-2]\.fits|\/api\/cutout\?/.test(r.url())) extraFitsRequests++;
    if (r.url().includes('/api/catalog?')) extraCatalogRequests++;
  });
  const pending = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Descargar informe JSON', exact: true }).click();
  const file = await pending;
  await file.saveAs(join(output, file.suggestedFilename()));
  const json = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(json.method).toBe('eon-evidence-rules-1');
  if (json.catalog) expect(json.catalog.records).toHaveLength(json.catalog.entries);
  expect(json.limits.instrumentQuality).toBe('not-evaluated');
  expect(json.limits.physicalMotion).toBe('not-evaluated');
  if (!live)
    expect(json.counts).toMatchObject({
      analyzed: 3,
      detections: 21,
      groups: 19,
      multiDateGroups: 1,
    });
  await page.getByLabel('Explorar fuente detectada').selectOption('');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.locator('.panel-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await report.scrollIntoViewIfNeeded();
  await report.screenshot({ path: join(output, 'mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (!live) await menu('Animación').click();
  await page.getByLabel('Intervalo entre fechas', { exact: true }).fill('100');
  await page.evaluate(() => {
    window.eonReportPresentations = [];
    const canvas = document.querySelector('.region-canvas');
    window.eonReportObserver = new MutationObserver(() =>
      window.eonReportPresentations.push(performance.now()),
    );
    window.eonReportObserver.observe(canvas, {
      attributes: true,
      attributeFilter: ['data-frame-id'],
    });
  });
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.eonReportPresentations.length), { timeout: 20000 })
    .toBeGreaterThanOrEqual(30);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const times = await page.evaluate(() => {
    window.eonReportObserver.disconnect();
    return window.eonReportPresentations;
  });
  const gaps = times
    .slice(1)
    .map((t, i) => t - times[i])
    .sort((a, b) => a - b);
  expect(extraFitsRequests).toBe(0);
  expect(extraCatalogRequests).toBe(0);
  expect(errors).toEqual([]);
  const verification = {
    base,
    liveArchive: live,
    counts: json.counts,
    playback: {
      presentations: times.length,
      medianMs: gaps[Math.floor(gaps.length / 2)],
      p95Ms: gaps[Math.floor(gaps.length * 0.95)],
    },
    extraFitsRequests,
    extraCatalogRequests,
    pageErrors: errors,
    file: file.suggestedFilename(),
  };
  writeFileSync(join(output, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log(JSON.stringify(verification));
} finally {
  await browser.close();
}
