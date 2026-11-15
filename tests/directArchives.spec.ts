import { expect, test } from '@playwright/test';
import { installTelescopeFixtures } from './telescopeFixtures';

test.beforeEach(async ({ page }) => {
  await installTelescopeFixtures(page);
});

test('Florida layers use direct tiles without Cloudflare or ESA and keep the same camera', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Webb', exact: true })
    .click();
  await page.getByRole('button', { name: 'Ver centro galáctico · Webb' }).click();
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-comparison-ready', 'true');
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')))
    .toBeCloseTo(266.5875292125761, 7);
  await page.getByRole('slider', { name: 'Transparencia del telescopio' }).press('End');
  await expect(sky).toHaveAttribute('data-comparison-opacity', '0');
  await page.getByLabel('Instrumento de Webb').selectOption('ivo://UFL/P/jwst-cmz-miri-coadd');
  await expect(sky).toHaveAttribute('data-comparison-id', 'ivo://UFL/P/jwst-cmz-miri-coadd');
  expect(requests.some((url) => url.includes('/jwst_nir_hips/'))).toBe(true);
  expect(requests.some((url) => url.includes('/jwst_miri_hips/'))).toBe(true);
  expect(
    requests.some((url) => url.includes('/api/telescope/') || url.includes('skies.esac')),
  ).toBe(false);
});

test('HLA searches explicitly; its bounded cutout is reused during pan and restored by a shared link', async ({
  page,
}) => {
  const fitsRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('fitscut.cgi')) fitsRequests.push(r.url());
  });
  await page.goto('/?ra=180.471267&dec=-18.882101&fov=.015');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page
    .getByRole('group', { name: 'Telescopio de comparación' })
    .getByRole('button', { name: 'Hubble', exact: true })
    .click();
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-comparison-ready', 'true');
  await page.getByRole('button', { name: 'Buscar Hubble aquí' }).click();
  const selector = page.getByLabel('Observación Hubble');
  await expect(selector).toBeVisible();
  await selector.selectOption('hst_10188_10_acs_wfc_f435w');
  await expect.poll(() => fitsRequests.length).toBe(2);
  await expect(sky).toHaveAttribute('data-comparison-ready', 'true');
  await sky.press('ArrowRight');
  await sky.press('+');
  await expect
    .poll(() => new URL(page.url()).searchParams.get('hla'))
    .toBe('hst_10188_10_acs_wfc_f435w');
  expect(fitsRequests).toHaveLength(2);
  for (const url of fitsRequests) expect(new URL(url).searchParams.get('size')).toBe('512');
  const shared = page.url();
  await page.goto(shared);
  await expect(page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky')).toHaveAttribute(
    'data-comparison-ready',
    'true',
  );
  await expect.poll(() => fitsRequests.length).toBe(3);
  expect(new URL(fitsRequests[2]).searchParams.get('red')).toBe('hst_10188_10_acs_wfc_f435w');
});

test('verified fields can be found on the sphere and opened directly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar controles' }).click();
  await page.getByText('Explorar campos observados', { exact: true }).click();
  await page.getByRole('button', { name: 'Ver campos en la esfera' }).click();
  await page.getByRole('button', { name: 'Ocultar controles' }).click();
  await expect(page.getByRole('button', { name: '⊕ Hubble · Antenas', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '⊕ Webb · centro galáctico', exact: true }).click();
  const sky = page.getByTitle('Cielo SPHEREx').contentFrame().locator('#sky');
  await expect(sky).toHaveAttribute('data-comparison-ready', 'true');
  await expect
    .poll(async () => Number(await sky.getAttribute('data-ra')))
    .toBeCloseTo(266.5875292125761, 7);
});
