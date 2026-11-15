import { test, expect } from '@playwright/test';
import { installTelescopeFixtures } from './telescopeFixtures';
import { regionGrid, gridCamera } from '../src/viewer/tangent';
test.beforeEach(async ({ page }) => {
  await installTelescopeFixtures(page);
});

test('an unresponsive archive times out explicitly without blocking SPHEREx', async ({ page }) => {
  await page.goto('/');
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://skies.esac.esa.int/JWST/**', async (route) => {
    await gate;
    await route.abort();
  });
  await page.clock.install();
  try {
    await page.getByRole('button', { name: 'Mostrar controles' }).click();
    await page
      .getByRole('group', { name: 'Telescopio de comparación' })
      .getByRole('button', { name: 'Webb', exact: true })
      .click();
    await expect(
      page.getByText('Cargando Webb · NIRCam desde ESA… SPHEREx sigue disponible.'),
    ).toBeVisible();
    await page.clock.fastForward(31000);
    await expect(page.getByRole('alert')).toContainText('ESA tardó demasiado');
    await expect(page.getByRole('button', { name: 'Reintentar comparación' })).toBeVisible();
    await expect(sky).toHaveAttribute('data-ready', 'true');
  } finally {
    release();
  }
});
test('HiPS telescopes share a single camera, offer both layouts and preserve the base on failure', async ({
  page,
}) => {
  await page.goto('/?ra=24.173958&dec=15.783667&fov=.14');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Webb', exact: true })
    .click();
  await expect(page.locator('iframe')).toHaveCount(1);
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-comparison-ready', 'true', { timeout: 30000 });
  await expect(sky).toHaveAttribute('data-comparison-opacity', '0.65');
  const slider = page.getByRole('slider', { name: 'Transparencia del telescopio' });
  await slider.press('Home');
  await expect(sky).toHaveAttribute('data-comparison-opacity', '1');
  await slider.press('End');
  await expect(sky).toHaveAttribute('data-comparison-opacity', '0');
  await expect(
    page.getByText('Las épocas no están sincronizadas:', { exact: false }),
  ).toBeVisible();
  await page.route('https://skies.esac.esa.int/HST/ACS/**', (r) => r.abort());
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Hubble', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('SPHEREx sigue disponible');
  await expect(sky).toHaveAttribute('data-ready', 'true');
});
test('archive TAN stays registered with the temporal grid while dates, pan and zoom change', async ({
  page,
}) => {
  await page.goto(
    '/?ra=60.8109955&dec=51.3404038&fov=.1&size=.1&cx=60.8109955&cy=51.3404038&epoch=2026W07_2A_0374_3%3ASPHEREx-D4',
  );
  const canvas = page.locator('.region-canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Webb', exact: true })
    .click();
  const archive = page.getByTitle('Cielo Webb').contentFrame().locator('#sky');
  await expect(archive).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  await expect(page.locator('.registered-archive')).toHaveCount(1);
  const grid = regionGrid({ longitude: 60.8109955, latitude: 51.3404038, sizeDeg: 0.1 });
  const worlds = [
    [0.2, 0.2],
    [0.5, 0.5],
    [0.8, 0.8],
  ].map(([x, y]) => grid.pixelToWorld(grid.size * x, grid.size * y));
  for (let step = 0; step < 3; step++) {
    const size = (await canvas.boundingBox())!.width;
    const view = {
      longitude: Number(await canvas.getAttribute('data-ra')),
      latitude: Number(await canvas.getAttribute('data-dec')),
      fov: Number(await canvas.getAttribute('data-fov')),
    };
    const camera = gridCamera(grid, view)!;
    const actual = await page
      .getByTitle('Cielo Webb')
      .contentFrame()
      .locator('body')
      .evaluate(
        (_, ws) =>
          ws.map(([ra, dec]) =>
            (
              window as unknown as {
                spherexProjection: { worldToPixel: (ra: number, dec: number) => number[] };
              }
            ).spherexProjection.worldToPixel(ra, dec),
          ),
        worlds,
      );
    const matrix = await page.locator('.registered-archive').evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { a: m.a, d: m.d, e: m.e, f: m.f };
    });
    for (let i = 0; i < worlds.length; i++) {
      const xy = grid.worldToPixel(...worlds[i])!;
      expect(
        Math.abs(
          actual[i][0] * matrix.a +
            matrix.e -
            (((xy[0] - camera.center[0]) / camera.span) * size + size / 2),
        ),
      ).toBeLessThan(0.1);
      expect(
        Math.abs(
          actual[i][1] * matrix.d +
            matrix.f -
            (((xy[1] - camera.center[1]) / camera.span) * size + size / 2),
        ),
      ).toBeLessThan(0.1);
    }
    await canvas.press(step === 0 ? 'ArrowRight' : '+');
  }
  await page.getByRole('slider', { name: 'Fecha', exact: true }).press('End');
  await expect(canvas).toHaveAttribute('data-frame-id', '2026W36_1A_0557_1:SPHEREx-D4');
  await expect(page.locator('iframe')).toHaveCount(1);
});
