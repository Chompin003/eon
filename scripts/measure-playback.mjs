/* global setTimeout, window, document, addEventListener, performance, process, console */
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { installArchiveFixtures } from '../tests/archiveFixtures.ts';
const browser = await chromium.launch({
  headless: true,
  args:
    process.env.EON_GPU === '1' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const live = process.env.EON_LIVE === '1';
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  });
  if (!live) await installArchiveFixtures(page);
  if (process.env.EON_METADATA)
    await page.route('**/api/observations?**', (route) =>
      route.fulfill({
        body: readFileSync(process.env.EON_METADATA),
        contentType: 'application/x-votable+xml',
      }),
    );
  // Controlled latency makes before/after comparable; this is not a WAN benchmark.
  if (!live)
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
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  const start = performance.now();
  await page
    .getByRole('button', { name: 'Ver exposición / centrar recorte' })
    .click({ timeout: 90000 });
  await expect(page.frameLocator('iframe').locator('#sky')).toHaveAttribute('data-source', 'fits', {
    timeout: 90000,
  });
  let retries = 0;
  if (await page.getByTestId('buffer-progress').count()) {
    const progress = page.getByTestId('buffer-progress');
    if (live) {
      let lastProgress = '';
      await expect
        .poll(
          async () => {
            const text = await progress.innerText();
            if (text !== lastProgress) {
              lastProgress = text;
              console.log(text);
            }
            const prepared = Number(await progress.getAttribute('data-prepared'));
            const failed = Number(await progress.getAttribute('data-failed'));
            const total = Number(await progress.getAttribute('data-total'));
            if (failed && prepared + failed >= total && retries < 3) {
              retries++;
              await page.getByRole('button', { name: 'Reintentar cuadros' }).click();
            }
            return await progress.getAttribute('data-ready');
          },
          { timeout: 600000, intervals: [3000] },
        )
        .toBe('true');
    } else await expect(progress).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  }
  const preparationMs = performance.now() - start;
  const sequenceFrames =
    Number(await page.getByRole('slider', { name: 'Fecha', exact: true }).getAttribute('max')) + 1;
  const targetFrames = live ? sequenceFrames * 2 : 10;
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.evaluate(() => {
    window.__frames = [];
  });
  const before = { cutouts, navigations };
  const profiler = process.env.EON_PROFILE ? await page.context().newCDPSession(page) : undefined;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.start');
  }
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__frames.length), { timeout: live ? 120000 : 30000 })
    .toBeGreaterThanOrEqual(targetFrames);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    writeFileSync(process.env.EON_PROFILE, JSON.stringify(profile));
    await profiler.detach();
  }
  const frames = await page.evaluate((count) => window.__frames.slice(0, count), targetFrames);
  const gaps = frames
    .slice(1)
    .map((f, i) => f.at - frames[i].at)
    .sort((a, b) => a - b);
  const report = {
    controlledLatencyMs: live ? undefined : 150,
    source: live
      ? process.env.EON_METADATA
        ? 'recorded IRSA SIA metadata / live IRSA cutouts via local Pages Functions'
        : 'IRSA live / local Pages Functions'
      : 'three recorded IRSA exposures',
    sequenceFrames,
    retries,
    viewport: '900x650',
    renderer,
    intervalMs: 100,
    preparationMs,
    frames: frames.length,
    uniqueDates: new Set(frames.map((frame) => frame.date)).size,
    medianGapMs: gaps[Math.floor(gaps.length / 2)],
    p95GapMs: gaps[Math.ceil(gaps.length * 0.95) - 1],
    playbackCutoutRequests: cutouts - before.cutouts,
    playbackDocumentNavigations: navigations - before.navigations,
    initialHiPSTileRequests: hipsTiles,
  };
  if (process.env.EON_SCREENSHOT) await page.screenshot({ path: process.env.EON_SCREENSHOT });
  writeFileSync(
    process.env.EON_REPORT ?? 'data-cache/eon-baseline.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
