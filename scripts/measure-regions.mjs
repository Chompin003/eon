/* global document, window, performance, MutationObserver, process, console, setTimeout */
import { chromium, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { installArchiveFixtures } from '../tests/archiveFixtures.ts';
const live = process.env.EON_LIVE === '1';
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
  if (!live) await installArchiveFixtures(page);
  if (process.env.EON_METADATA)
    await page.route('**/api/observations?**', (route) =>
      route.fulfill({
        body: readFileSync(process.env.EON_METADATA),
        contentType: 'application/x-votable+xml',
      }),
    );
  if (!live)
    await page.route('**/api/cutout?**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fallback();
    });
  let cutouts = 0,
    navigations = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/cutout?')) cutouts++;
  });
  page.on('framenavigated', (f) => {
    if (f !== page.mainFrame()) navigations++;
  });
  await page.addInitScript(() => {
    window.__regionFrames = [];
    const last = new WeakMap();
    new MutationObserver(() => {
      const canvas = document.querySelector('.region-canvas');
      if (
        canvas?.dataset.ready === 'true' &&
        canvas.dataset.frameId &&
        last.get(canvas) !== canvas.dataset.frameId
      ) {
        last.set(canvas, canvas.dataset.frameId);
        window.__regionFrames.push({ id: canvas.dataset.frameId, at: performance.now() });
      }
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ready', 'data-frame-id'],
    });
  });
  await page.goto(process.env.EON_MEASURE_URL ?? 'http://127.0.0.1:4174');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByRole('button', { name: 'Buscar exposiciones aquí' }).click();
  const activatedAt = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'Animar región' }).click({ timeout: 60000 });
  const progress = page.getByTestId('buffer-progress');
  let previous = '';
  await expect
    .poll(
      async () => {
        const text = await progress.innerText();
        if (text !== previous) {
          previous = text;
          console.log(text);
        }
        return await progress.getAttribute('data-complete');
      },
      { timeout: 240000, intervals: [1000] },
    )
    .toBe('true');
  const preparedAt = await page.evaluate(() => performance.now());
  const firstFrame = await page.evaluate(() => window.__regionFrames[0]);
  const total = Number(await progress.getAttribute('data-total')),
    ready = Number(await progress.getAttribute('data-prepared')),
    failed = Number(await progress.getAttribute('data-failed'));
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).press('Home');
  await page.evaluate(() => {
    window.__regionFrames = [];
  });
  const before = { cutouts, navigations },
    count = live ? ready * 2 : 30;
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.__regionFrames.length), { timeout: 120000 })
    .toBeGreaterThanOrEqual(count);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const frames = await page.evaluate((n) => window.__regionFrames.slice(0, n), count);
  const gaps = frames
    .slice(1)
    .map((f, i) => f.at - frames[i].at)
    .sort((a, b) => a - b);
  const report = {
    player: 'registered TAN/SIP + Canvas 2D',
    source: live ? 'IRSA cutouts via Pages Functions' : 'three recorded official IRSA FITS',
    recordedMetadata: Boolean(process.env.EON_METADATA),
    controlledLatencyMs: live ? undefined : 150,
    viewport: '900x650',
    intervalMs: 100,
    total,
    ready,
    failed,
    firstUsableMs: firstFrame?.at - activatedAt,
    preparationMs: preparedAt - activatedAt,
    frames: frames.length,
    uniqueDates: new Set(frames.map((f) => f.id)).size,
    medianGapMs: gaps[Math.floor(gaps.length / 2)],
    p95GapMs: gaps[Math.ceil(gaps.length * 0.95) - 1],
    playbackCutoutRequests: cutouts - before.cutouts,
    playbackDocumentNavigations: navigations - before.navigations,
    remainingWebGLPanes: await page.locator('iframe').count(),
  };
  writeFileSync(
    process.env.EON_REPORT ?? 'data-cache/region-performance.json',
    JSON.stringify(report, null, 2),
  );
  if (process.env.EON_SCREENSHOT) await page.screenshot({ path: process.env.EON_SCREENSHOT });
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
