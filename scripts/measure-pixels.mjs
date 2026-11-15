/* global process,console,window,performance,MutationObserver,document */
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  if (process.env.EON_BLOCK_ARCHIVES !== '0')
    await page.route('https://**/*', (r) =>
      r
        .request()
        .url()
        .startsWith(process.env.EON_MEASURE_URL ?? 'http://127.0.0.1:4174')
        ? r.continue()
        : r.abort(),
    );
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/examples/spherex/epoch-')) requests++;
  });
  await page.addInitScript(() => {
    window.__measuredFrames = [];
    const last = new WeakMap();
    new MutationObserver(() => {
      const c = document.querySelector('.region-canvas');
      if (c?.dataset.ready === 'true' && c.dataset.frameId && last.get(c) !== c.dataset.frameId) {
        last.set(c, c.dataset.frameId);
        window.__measuredFrames.push({ id: c.dataset.frameId, at: performance.now() });
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-frame-id', 'data-ready'],
    });
  });
  await page.goto(
    (process.env.EON_MEASURE_URL ?? 'http://127.0.0.1:4174') +
      '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4',
  );
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const start = performance.now();
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toBeVisible({ timeout: 30000 });
  const analysisMs = performance.now() - start;
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON', exact: true }).click();
  const file = await download,
    result = JSON.parse(readFileSync(await file.path(), 'utf8'));
  const chosen = [...result.tracks].sort(
    (a, b) => b.measurements.length - a.measurements.length,
  )[0];
  await page.getByLabel('Explorar fuente detectada').selectOption(chosen.id);
  await page.getByText('Mediciones y fechas', { exact: true }).click();
  await page
    .locator('.measurement-table')
    .getByRole('button', { name: 'Abrir', exact: true })
    .first()
    .click();
  await page.locator('.pixel-results').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  if (process.env.EON_SCREENSHOT) await page.screenshot({ path: process.env.EON_SCREENSHOT });
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.evaluate(() => {
    window.__measuredFrames = [];
  });
  const before = requests;
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__measuredFrames.length), { timeout: 15000 })
    .toBeGreaterThanOrEqual(30);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const frames = await page.evaluate(() => window.__measuredFrames.slice(0, 30));
  const gaps = frames
    .slice(1)
    .map((f, i) => f.at - frames[i].at)
    .sort((a, b) => a - b);
  const all = result.frames.flatMap((f) => f.detections);
  const report = {
    method: result.method,
    analysisMs,
    workerSeconds: result.seconds,
    frames: result.frames.map((f) => ({ id: f.frameId, detections: f.detections.length })),
    tracks: result.tracks.length,
    persistentTracks: result.tracks.filter((t) => t.measurements.length > 1).length,
    associations: {
      candidate: all.filter((d) => d.association === 'candidate').length,
      ambiguous: all.filter((d) => d.association === 'ambiguous').length,
      none: all.filter((d) => d.association === 'none').length,
    },
    presentations: frames.length,
    medianMs: gaps[Math.floor(gaps.length / 2)],
    p95Ms: gaps[Math.ceil(gaps.length * 0.95) - 1],
    playbackFitsRequests: requests - before,
    iframes: await page.locator('iframe').count(),
  };
  writeFileSync(
    process.env.EON_REPORT ?? 'data-cache/pixel-performance.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
