import { openControls } from './controlMenus';
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures';
const example =
  '/?example=ngc1491&ra=60.8109955&dec=51.3404038&fov=.1&size=.1&epoch=2025W34_2B_0099_1%3ASPHEREx-D4';

async function openExample(page: Page) {
  await page.route('https://**/*', (r) => r.abort());
  await page.goto(example);
  await expect(page.locator('.region-canvas')).toHaveAttribute('data-ready', 'true');
  await openControls(page);
  await expect(page.getByTestId('buffer-progress')).toHaveAttribute('data-ready', 'true');
}
async function download(page: Page, format: 'PNG' | 'GIF', info: TestInfo, label = 'export') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: `Descargar ${format}`, exact: true }).click();
  const file = await pending;
  await file.saveAs(info.outputPath(`${label}.${format.toLowerCase()}`));
  const bytes = readFileSync((await file.path())!);
  return { name: file.suggestedFilename(), bytes };
}
async function pngPixels(page: Page, bytes: Buffer, probes: [number, number][] = []) {
  return page.evaluate(
    async ({ data, probes }) => {
      const image = await createImageBitmap(
        new Blob([Uint8Array.from(data)], { type: 'image/png' }),
      );
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      image.close();
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0,
        transparent = 0,
        colored = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] === 255) opaque++;
        if (rgba[i + 3] === 0) transparent++;
        if (
          rgba[i + 3] > 0 &&
          Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) -
            Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) >
            20
        )
          colored++;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        opaque,
        transparent,
        colored,
        alpha: probes.map(([x, y]) => rgba[(Math.round(y) * canvas.width + Math.round(x)) * 4 + 3]),
      };
    },
    { data: [...bytes], probes },
  );
}

test('PNG exports real space without controls, then annotations with transparency and erasure', async ({
  page,
}, info) => {
  await openExample(page);
  await page.getByLabel('Anotaciones', { exact: true }).uncheck();
  const sky = await download(page, 'PNG', info, 'space');
  expect(sky.name).toBe('eon_J2000_RA04h03m14.64s_Dec+51d20m25.45s.png');
  expect(sky.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const stats = await pngPixels(page, sky.bytes);
  expect(stats.width).toBe(stats.height);
  expect(stats.opaque).toBe(stats.width * stats.height);
  expect(stats.colored).toBe(0);

  await page.getByLabel('Anotar (bloquea arrastre del cielo)').check();
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.mouse.move(600, 500);
  await page.mouse.down();
  await page.mouse.move(1000, 500, { steps: 20 });
  await page.mouse.up();
  await expect(page.locator('.study-annotations')).toHaveAttribute('data-annotation-count', '1');
  await openControls(page);
  await page.getByRole('button', { name: 'Borrador parcial', exact: true }).click();
  await page.getByRole('slider', { name: 'Grosor', exact: true }).fill('50');
  await page.getByRole('button', { name: 'Cerrar controles' }).click();
  await page.mouse.move(800, 450);
  await page.mouse.down();
  await page.mouse.move(800, 550, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.study-annotations mask')).toHaveCount(1);
  await openControls(page);
  await page.getByLabel('Imagen del espacio', { exact: true }).uncheck();
  await page.getByLabel('Anotaciones', { exact: true }).check();
  const annotation = await download(page, 'PNG', info, 'annotations');
  const rect = (await page.locator('.region-canvas').boundingBox())!;
  const paint = await pngPixels(page, annotation.bytes, [
    [700 - rect.x, 500 - rect.y],
    [800 - rect.x, 500 - rect.y],
  ]);
  expect(paint.transparent).toBeGreaterThan(paint.width * paint.height * 0.95);
  expect(paint.colored).toBeGreaterThan(200);
  expect(paint.colored).toBeLessThan(5000);
  expect(paint.alpha).toEqual([255, 0]);
});

test('PNG can export analysis markers independently, and all layers together', async ({
  page,
}, info) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones');
  await page.getByLabel('Imagen del espacio', { exact: true }).uncheck();
  await page.getByLabel('Anotaciones', { exact: true }).uncheck();
  const marks = await download(page, 'PNG', info, 'markers');
  const stats = await pngPixels(page, marks.bytes);
  expect(stats.transparent).toBeGreaterThan(stats.width * stats.height * 0.95);
  expect(stats.opaque).toBeGreaterThan(200);
  await page.getByRole('button', { name: 'Todas las capas' }).click();
  const all = await download(page, 'PNG', info, 'all');
  expect(all.bytes.equals(marks.bytes)).toBe(false);
  const combined = await pngPixels(page, all.bytes);
  expect(combined.opaque).toBe(combined.width * combined.height);
});

test('GIF contains distinct prepared epochs, timing, loop and no new FITS', async ({
  page,
}, info) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Interpretar región', exact: true }).click();
  await expect(page.getByTestId('pixel-summary')).toContainText('3 exposiciones');
  await page.getByRole('slider', { name: 'Intervalo entre fechas' }).fill('350');
  await page.getByRole('button', { name: 'Animación GIF', exact: true }).click();
  await expect(page.getByLabel('Imagen del espacio', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Imagen del espacio', { exact: true })).toBeChecked();
  await page.getByLabel('Lado máximo del GIF').selectOption('512');
  let requests = 0;
  page.on('request', (request) => {
    if (/epoch-[0-2]\.fits/.test(request.url())) requests++;
  });
  const file = await download(page, 'GIF', info);
  expect(file.name).toContain(
    'J2000_RA04h03m14.64s_Dec+51d20m25.45s_2025-08-22T003848Z--2026-09-02T103630Z.gif',
  );
  expect(file.bytes.subarray(0, 6).toString()).toBe('GIF89a');
  expect(file.bytes.includes(Buffer.from('NETSCAPE2.0'))).toBe(true);
  const decoded = await page.evaluate(
    async (data) => {
      interface Decoder {
        tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } };
        decode(options: { frameIndex: number }): Promise<{ image: VideoFrame }>;
        close(): void;
      }
      const DecoderClass = (
        globalThis as unknown as {
          ImageDecoder: new (options: { data: Uint8Array; type: string }) => Decoder;
        }
      ).ImageDecoder;
      const decoder = new DecoderClass({ data: Uint8Array.from(data), type: 'image/gif' });
      await decoder.tracks.ready;
      const frames = [];
      for (let i = 0; i < decoder.tracks.selectedTrack.frameCount; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const canvas = document.createElement('canvas');
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const digest = await crypto.subtle.digest(
          'SHA-256',
          ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        );
        frames.push({
          width: canvas.width,
          height: canvas.height,
          duration: image.duration,
          digest: [...new Uint8Array(digest)].join(','),
        });
        image.close();
      }
      decoder.close();
      return frames;
    },
    [...file.bytes],
  );
  expect(decoded).toHaveLength(3);
  expect(decoded.every((f) => f.width === 512 && f.height === 512 && f.duration === 350000)).toBe(
    true,
  );
  expect(new Set(decoded.map((f) => f.digest)).size).toBe(3);
  expect(requests).toBe(0);
  await expect(page.locator('.region-canvas')).toHaveAttribute(
    'data-frame-id',
    '2025W34_2B_0099_1:SPHEREx-D4',
  );
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
});

test('GIF cancellation does not download a partial file and allows retry', async ({
  page,
}, info) => {
  await openExample(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let hold = true,
    downloads = 0;
  page.on('download', () => downloads++);
  await page.route('**/assets/gifWorker-*.js', async (route) => {
    if (hold) await gate;
    try {
      await route.continue();
    } catch {
      /* Terminated on cancellation. */
    }
  });
  try {
    await page.getByRole('button', { name: 'Animación GIF', exact: true }).click();
    await page.getByRole('button', { name: 'Descargar GIF', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Creando GIF' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar exportación' }).click();
    await expect(page.getByText('Exportación cancelada.', { exact: true })).toBeVisible();
    expect(downloads).toBe(0);
    hold = false;
    release();
    const file = await download(page, 'GIF', info, 'retry');
    expect(file.bytes.subarray(0, 6).toString()).toBe('GIF89a');
  } finally {
    hold = false;
    release();
  }
});

test('HiPS PNG uses the real Aladin export API and split panes are composed', async ({
  page,
}, info) => {
  await installArchiveFixtures(page);
  await page.goto('/');
  await expect(page.locator('.sky-canvas').first()).toHaveAttribute('data-connected', 'true');
  await openControls(page);
  const file = await download(page, 'PNG', info, 'hips');
  const stats = await pngPixels(page, file.bytes);
  expect(stats.width).toBeGreaterThan(stats.height);
  expect(stats.opaque).toBeGreaterThan(500000);
  await page.getByRole('button', { name: 'Pantalla dividida', exact: true }).click();
  await expect(page.locator('.sky-canvas[data-connected="true"]')).toHaveCount(2);
  const split = await download(page, 'PNG', info, 'split');
  expect(split.bytes.equals(file.bytes)).toBe(false);
});
