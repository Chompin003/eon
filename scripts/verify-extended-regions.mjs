/* global process,console */
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';
import provenance from '../tests/fixtures/spherex/provenance.json' with { type: 'json' };
import wideSource from '../tests/fixtures/spherex/wide-provenance.json' with { type: 'json' };
const base = process.env.EON_VERIFY_URL ?? 'http://127.0.0.1:4174',
  output = process.env.EON_WIDE_OUTPUT ?? 'output/wide-verification';
mkdirSync(output, { recursive: true });
const wide = readFileSync('tests/fixtures/spherex/wide-epoch.fits');
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://**/*', (r) =>
    r.request().url().startsWith(base) ? r.continue() : r.abort(),
  );
  // Controlled UI verification uses only recorded official data; it is not a live inventory.
  await page.route('**/api/observations?**', (r) =>
    r.fulfill({
      body: readFileSync('tests/fixtures/spherex/observations.xml'),
      contentType: 'application/xml',
    }),
  );
  await page.route('**/api/cutout?**', (r) => {
    const input = new URL(r.request().url()).searchParams.get('url'),
      frame = provenance.exposures.find((e) => e.url === input);
    return frame
      ? r.fulfill({
          body:
            frame.id === provenance.exposures[0].id
              ? wide
              : readFileSync('tests/fixtures/spherex/' + frame.fixture),
          contentType: 'application/fits',
        })
      : r.fulfill({ status: 404 });
  });
  await page.route('**/api/catalog?**', (r) =>
    r.fulfill({
      body: readFileSync(
        'public/examples/spherex/' +
          (new URL(r.request().url()).searchParams.get('provider') === 'gaia'
            ? 'gaia.xml'
            : 'simbad.json'),
      ),
      contentType: 'text/plain',
    }),
  );
  await page.goto(
    base +
      '/?ra=60.8109955&dec=51.3404038&fov=1&size=1&wide=1&epoch=' +
      encodeURIComponent(provenance.exposures[0].id),
  );
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('.region-canvas')).toHaveAttribute(
    'data-frame-id',
    provenance.exposures[0].id,
  );
  await expect(page.locator('.angular-scale')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  for (const menu of await page.locator('[data-control-menu]').all())
    if ((await menu.getAttribute('open')) === null) await menu.locator(':scope > summary').click();
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones analizadas', {
    timeout: 30000,
  });
  await page.getByLabel('Modo ampliado · hasta 60′', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.EON_WIDE_SCREENSHOT ?? join(output, 'controls.png') });
  let fitsRequests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cutout?')) fitsRequests++;
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar PNG', exact: true }).click();
  const file = await download;
  await file.saveAs(join(output, file.suggestedFilename()));
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.screenshot({ path: process.env.EON_SCALE_SCREENSHOT ?? join(output, 'scale.png') });
  expect(fitsRequests).toBe(0);
  expect(errors).toEqual([]);
  const report = {
    base,
    controlledRecordedData: true,
    scaleSeconds: Number(await page.locator('.angular-scale').getAttribute('data-arcsec')),
    newFitsRequests: fitsRequests,
    pageErrors: errors,
    png: file.suggestedFilename(),
  };
  if (process.env.EON_LIVE_CUTOUT === '1') {
    const original = new URL(wideSource.url);
    original.search = '';
    const query = new URLSearchParams({
      url: String(original),
      ra: '60.8109955',
      dec: '51.3404038',
      size: '1.5',
      extended: '1',
    });
    const response = await globalThis.fetch(base + '/api/cutout?' + query, {
      signal: globalThis.AbortSignal.timeout(70000),
    });
    if (!response.ok) throw Error('El recorte vivo respondió ' + response.status);
    const data = new Uint8Array(await response.arrayBuffer());
    const sha = createHash('sha256').update(data).digest('hex'),
      expected = createHash('sha256').update(wide).digest('hex');
    expect(sha).toBe(expected);
    report.liveCutout = { bytes: data.byteLength, sha256: sha };
  }
  writeFileSync(join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
