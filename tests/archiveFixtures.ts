import { readFileSync } from 'node:fs';
import { type Page } from '@playwright/test';
import provenance from './fixtures/spherex/provenance.json' with { type: 'json' };

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/spherex/${name}`, import.meta.url));

/** Offline UI tests use recorded IRSA metadata and FITS images.
 * Only HiPS tile painting is simplified: one real tile per channel is repeated.
 * These tests do NOT claim astrometric verification from that repeated texture.
 * Real network imagery is checked separately against IRSA before publishing.
 */
export async function installArchiveFixtures(page: Page) {
  await page.route(
    'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/**',
    async (route) => {
      const url = route.request().url();
      if (url.endsWith('/properties'))
        await route.fulfill({
          body: fixture('properties'),
          contentType: 'text/plain',
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      else if (url.endsWith('/Moc.fits'))
        await route.fulfill({
          body: fixture('Moc.fits'),
          contentType: 'application/fits',
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      else if (url.endsWith('.png'))
        await route.fulfill({
          body: fixture(url.endsWith('_85.png') ? 'tile-85.png' : 'tile-63.png'),
          contentType: 'image/png',
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      else await route.fulfill({ status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    },
  );
  await page.route('**/api/observations?**', (route) =>
    route.fulfill({ body: fixture('observations.xml'), contentType: 'application/x-votable+xml' }),
  );
  await page.route('**/api/cutout?**', (route) => {
    const input = new URL(route.request().url()).searchParams.get('url');
    const exposure = provenance.exposures.find((entry) => entry.url === input);
    return route.fulfill(
      exposure
        ? { body: fixture(exposure.fixture), contentType: 'application/fits' }
        : { status: 404 },
    );
  });
}

export { provenance };
