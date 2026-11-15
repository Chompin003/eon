import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { installArchiveFixtures } from './archiveFixtures.ts';

/** Recorded ESA metadata/MOCs and one real M74 tile per instrument.
 * Repeated tiles are UI fixtures only, never runtime fallbacks or science validation.
 */
export async function installTelescopeFixtures(page: Page) {
  await installArchiveFixtures(page);
  const directFile = (name: string) =>
    readFileSync(new URL(`./fixtures/direct/${name}`, import.meta.url));
  await page.route('https://hla.stsci.edu/**', async (route) => {
    const search = route.request().url().includes('hlaSIAP');
    await route.fulfill({
      body: directFile(search ? 'hubble-search.xml' : 'hubble.fits'),
      contentType: search ? 'application/xml' : 'application/fits',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.route('https://starformation.astro.ufl.edu/avm_images/**', async (route) => {
    const url = route.request().url();
    const prefix = url.includes('jwst_miri_hips') ? 'miri' : 'nir';
    const suffix = url.endsWith('properties')
      ? 'properties'
      : url.includes('Allsky')
        ? 'allsky.png'
        : 'tile.png';
    await route.fulfill({
      body: directFile(`${prefix}-${suffix}`),
      contentType: suffix === 'properties' ? 'text/plain' : 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  const sources = [
    ['HST/ACS/', 'hubble-acs', 'jpg'],
    ['HST/WFC3/', 'hubble-wfc3', 'jpg'],
    ['JWST/NIRCam_Imaging/', 'webb-nircam', 'png'],
    ['JWST/MIRI_Imaging/', 'webb-miri', 'png'],
  ];
  const file = (name: string) =>
    readFileSync(new URL(`./fixtures/telescopes/${name}`, import.meta.url));
  await page.route('**/api/telescope/**', async (route) => {
    const parts = new URL(route.request().url()).pathname.split('/');
    const source = sources[Number(parts[3])];
    const url = parts.slice(4).join('/');
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (!source) {
      await route.fulfill({ status: 404, headers });
      return;
    }
    const [, name, format] = source;
    if (url === 'properties')
      await route.fulfill({
        body: file(`${name}-properties.txt`),
        contentType: 'text/plain',
        headers,
      });
    else if (url === 'Moc.fits')
      await route.fulfill({
        body: file(`${name}-Moc.fits`),
        contentType: 'application/fits',
        headers,
      });
    else if (url.endsWith(`/Allsky.${format}`))
      await route.fulfill({
        body: file(`${name}-allsky.${format}`),
        contentType: format === 'jpg' ? 'image/jpeg' : 'image/png',
        headers,
      });
    else if (url.endsWith(`.${format}`))
      await route.fulfill({
        body: file(`${name}-tile.${format}`),
        contentType: format === 'jpg' ? 'image/jpeg' : 'image/png',
        headers,
      });
    else await route.fulfill({ status: 404, headers });
  });
}
