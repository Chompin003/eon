import { expect, test } from '@playwright/test';
import { installTelescopeFixtures } from './telescopeFixtures';

test.beforeEach(async ({ page }) => {
  await installTelescopeFixtures(page);
});

test('SPHEREx is default; Hubble and Webb comparisons synchronize coordinates, zoom and coverage', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) =>
    errors.push(
      (error.stack ?? error.message).replace(
        /data:application\/wasm;base64,[A-Za-z0-9+/=]+/g,
        '[wasm]',
      ),
    ),
  );
  await page.goto('/');
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  const controls = page.getByRole('group', { name: 'Telescopio de comparación' });
  await expect(controls.getByRole('button', { name: 'SPHEREx', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await controls.getByRole('button', { name: 'Hubble', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(2);
  const left = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  let right = page.getByTitle('Cielo Hubble').contentFrame().locator('#sky');
  await expect(right).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByText('El centro está fuera de la cobertura de este mosaico.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ver M74 · cobertura común' }).click();
  await expect(page.locator('.coverage-notice')).toHaveCount(0);
  await expect
    .poll(async () => Number(await left.getAttribute('data-ra')))
    .toBeCloseTo(24.173958, 7);
  await expect
    .poll(async () => Number(await right.getAttribute('data-dec')))
    .toBeCloseTo(15.783667, 7);
  await right.press('ArrowRight');
  await right.press('+');
  for (const attribute of ['data-ra', 'data-dec', 'data-fov'])
    await expect
      .poll(async () =>
        Math.abs(
          Number(await left.getAttribute(attribute)) - Number(await right.getAttribute(attribute)),
        ),
      )
      .toBeLessThan(1e-7);
  await page
    .getByLabel('Instrumento de Hubble')
    .selectOption({ label: 'WFC3 · todos los filtros' });
  right = page.getByTitle('Cielo Hubble').contentFrame().locator('#sky');
  await expect(right).toHaveAttribute('data-ready', 'true');
  await controls.getByRole('button', { name: 'Webb', exact: true }).click();
  right = page.getByTitle('Cielo Webb').contentFrame().locator('#sky');
  await expect(right).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Instrumento de Webb')).toHaveValue(
    'ivo://ESAVO/P/JWST/NIRCam_Imaging',
  );
  await page.getByLabel('Instrumento de Webb').selectOption({ label: 'MIRI · mosaico de archivo' });
  right = page.getByTitle('Cielo Webb').contentFrame().locator('#sky');
  await expect(right).toHaveAttribute('data-ready', 'true');
  await expect
    .poll(async () =>
      Math.abs(
        Number(await left.getAttribute('data-fov')) - Number(await right.getAttribute('data-fov')),
      ),
    )
    .toBeLessThan(1e-7);
  await controls.getByRole('button', { name: 'SPHEREx', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('an archive failure leaves SPHEREx usable and comparisons retain Paint layers', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.locator('spherex-paint').locator('summary').first().click();
  await page.locator('spherex-paint').locator('#emoji-picker > summary').click();
  await page.getByRole('searchbox', { name: 'Buscar emoji' }).fill('cohete');
  await page.getByRole('button', { name: 'Insertar cohete', exact: true }).click();
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(1);
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Webb', exact: true })
    .click();
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(2);
  await page.route('https://skies.esac.esa.int/HST/ACS/**', (route) => route.abort());
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Hubble', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar Hubble');
  await expect(page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'SPHEREx', exact: true })
    .click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.study-annotations [data-item]')).toHaveCount(1);
});
