/* global process,console */
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
const base = process.env.EON_VERIFY_URL ?? 'http://127.0.0.1:4174';
async function openControls(page) {
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  for (const menu of await page.locator('[data-control-menu]').all()) {
    if ((await menu.getAttribute('open')) === null) await menu.locator(':scope > summary').click();
  }
}
const output = process.env.EON_EXPORT_OUTPUT ?? 'output/exports';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('https://**/*', (route) =>
    route.request().url().startsWith(base) ? route.continue() : route.abort(),
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    base +
      '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await openControls(page);
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones', {
    timeout: 30000,
  });
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').check();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.mouse.move(650, 450);
  await page.mouse.down();
  await page.mouse.move(900, 500, { steps: 10 });
  await page.mouse.up();
  await openControls(page);
  await page.getByLabel('Anotar (bloquea arrastre del cielo)').uncheck();
  const panel = page.getByRole('region', { name: 'Descargar vista' });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: process.env.EON_EXPORT_SCREENSHOT ?? join(output, 'controls.png'),
  });
  let requests = 0;
  page.on('request', (r) => {
    if (/epoch-[0-2]\.fits/.test(r.url())) requests++;
  });
  const files = [];
  for (const [format, role] of [
    ['PNG', 'all'],
    ['GIF', 'all'],
    ['GIF', 'space-only'],
  ]) {
    if (format === 'GIF')
      await page.getByRole('button', { name: 'Animación GIF', exact: true }).click();
    if (role === 'space-only') {
      await page.getByLabel('Anotaciones', { exact: true }).uncheck();
      await page.getByLabel('Marcadores del análisis', { exact: true }).uncheck();
    }
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Descargar ${format}`, exact: true }).click();
    const file = await pending;
    mkdirSync(join(output, role), { recursive: true });
    await file.saveAs(join(output, role, file.suggestedFilename()));
    const data = readFileSync(await file.path());
    if (format === 'PNG')
      expect(data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    else expect(data.subarray(0, 6).toString()).toBe('GIF89a');
    expect(file.suggestedFilename()).toContain('J2000_RA04h03m14.64s_Dec+51d20m25.45s');
    files.push({ role, filename: file.suggestedFilename(), bytes: data.length });
  }
  expect(requests).toBe(0);
  expect(errors).toEqual([]);
  await expect(page.locator('.region-canvas')).toHaveAttribute(
    'data-frame-id',
    '2025W34_2B_0099_1:SPHEREx-D4',
  );
  const report = { base, files, newFitsRequests: requests, pageErrors: errors };
  writeFileSync(join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
