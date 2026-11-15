/* global setTimeout, window, document, addEventListener, performance, process, console */
import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { installArchiveFixtures } from '../tests/archiveFixtures.ts';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  await installArchiveFixtures(page);
  // Controlled latency makes before/after comparable; this is not a WAN benchmark.
  await page.route('**/api/cutout?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fallback();
  });
  let cutouts = 0,
    navigations = 0,
    hipsTiles = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cutout?')) cutouts++;
    if (/Npix\d+_\d+\.png/.test(r.url())) hipsTiles++;
  });
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) navigations++;
  });
  await page.addInitScript(() => {
    window.__frames = [];
    let previous = '';
    addEventListener('message', (e) => {
      if (e.data?.type !== 'sky:ready' && e.data?.type !== 'sky:presented') return;
      const date = document.querySelector('[data-testid="epoch-date"]')?.textContent;
      if (date && date !== previous) {
        previous = date;
        window.__frames.push({ date, at: performance.now() });
      }
    });
  });
  await page.goto(process.env.EON_MEASURE_URL ?? 'http://127.0.0.1:4174');
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  const start = performance.now();
  await page.getByRole('button', { name: 'Ver exposición / centrar recorte' }).click();
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-source', 'fits');
  if (await page.getByTestId('buffer-progress').count())
    await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true', {
      timeout: 60000,
    });
  const preparationMs = performance.now() - start;
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.evaluate(() => {
    window.__frames = [];
  });
  const before = { cutouts, navigations };
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__frames.length), { timeout: 30000 })
    .toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const frames = await page.evaluate(() => window.__frames.slice(0, 10));
  const gaps = frames
    .slice(1)
    .map((f, i) => f.at - frames[i].at)
    .sort((a, b) => a - b);
  const report = {
    controlledLatencyMs: 150,
    viewport: '900x650 / software WebGL',
    intervalMs: 100,
    preparationMs,
    frames: frames.length,
    medianGapMs: gaps[Math.floor(gaps.length / 2)],
    p95GapMs: gaps[Math.ceil(gaps.length * 0.95) - 1],
    playbackCutoutRequests: cutouts - before.cutouts,
    playbackDocumentNavigations: navigations - before.navigations,
    initialHiPSTileRequests: hipsTiles,
  };
  writeFileSync(
    process.env.EON_REPORT ?? 'data-cache/eon-baseline.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
