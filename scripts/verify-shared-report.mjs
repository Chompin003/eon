/* global process, console */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
const base = process.env.EON_VERIFY_URL ?? 'http://127.0.0.1:4174';
const output = resolve(process.env.EON_SHARE_OUTPUT ?? 'output/shared-report');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(
    base +
      '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
    timeout: 120000,
  });
  await page.getByRole('button', { name: 'Mostrar controles', exact: true }).click();
  const menu = page
    .locator('[data-control-menu]')
    .filter({ has: page.locator(':scope > summary strong', { hasText: /^Análisis$/ }) });
  if ((await menu.getAttribute('open')) === null) await menu.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  const report = page.getByTestId('interpretation-report');
  await expect(report.getByTestId('interpretation-summary')).toContainText(
    '21 detecciones retenidas',
    { timeout: 120000 },
  );
  await report.getByText('Compartir informe', { exact: true }).click();
  let extraRequests = 0;
  page.on('request', (r) => {
    if (/epoch-[0-2]\.fits|\/api\/(catalog|cutout|observations)\?/.test(r.url())) extraRequests++;
  });
  const files = {};
  for (const [format, label] of [
    ['txt', 'TXT'],
    ['html', 'HTML / PDF'],
    ['json', 'JSON'],
  ]) {
    const pending = page.waitForEvent('download');
    await report.getByRole('button', { name: `Descargar informe ${label}`, exact: true }).click();
    const file = await pending;
    const path = join(output, file.suggestedFilename());
    await file.saveAs(path);
    files[format] = path;
  }
  const json = JSON.parse(readFileSync(files.json, 'utf8'));
  expect(json.counts.detections).toBe(21);
  expect(json.groupMeasurements).toHaveLength(21);
  expect(json.groupReports).toHaveLength(19);
  expect(json.selectedGroup).toBeUndefined();
  expect(json.viewUrl).toContain('example=ngc1491');
  const share = report.locator('.report-share');
  const guide = await page.request.get(
    new URL(await share.locator('a').getAttribute('href'), base).href,
  );
  expect(guide.ok()).toBe(true);
  expect((await guide.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await share.screenshot({ path: join(output, 'share-menu.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  if ((await share.getAttribute('open')) === null) await share.locator(':scope > summary').click();
  expect(
    await page.locator('.panel-content').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  await share.screenshot({ path: join(output, 'share-mobile.png') });
  const offline = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  let external = 0;
  await offline.route(/^https?:/, (r) => {
    external++;
    return r.abort();
  });
  await offline.goto(pathToFileURL(files.html).href);
  await expect(
    offline.getByRole('heading', {
      name: 'eon · Informe de interpretación de región',
      exact: true,
    }),
  ).toBeVisible();
  await expect(offline.getByRole('heading', { name: 'Grupo D0019', exact: true })).toBeVisible();
  await expect(offline.locator('script,iframe,img')).toHaveCount(0);
  await offline.screenshot({ path: join(output, 'readable-report.png') });
  await offline.pdf({
    path: join(output, 'example-report-printed.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  expect(external).toBe(0);
  expect(extraRequests).toBe(0);
  expect(errors).toEqual([]);
  const result = {
    base,
    counts: json.counts,
    groupReports: json.groupReports.length,
    measurements: json.groupMeasurements.length,
    extraRequests,
    external,
    errors,
  };
  writeFileSync(join(output, 'verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
