import { afterEach, expect, it, vi } from 'vitest';
import { onRequestGet } from '../functions/api/telescope/[[path]]';

afterEach(() => vi.unstubAllGlobals());
const context = (path: string) => ({
  request: new Request(`https://example.org/api/telescope/${path}`),
  params: { path: path.split('/') },
  waitUntil: () => {},
});

it('only transports known datasets and valid HiPS tile coordinates', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('creator_did = ESA'));
  vi.stubGlobal('fetch', fetcher);
  for (const path of [
    '9/properties',
    '0/https://evil.org',
    '0/Norder16/Dir0/Npix0.png',
    '0/Norder0/Dir0/Npix12.png',
    '0/Norder8/Dir0/Npix294378.jpg',
  ])
    expect((await onRequestGet(context(path))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  const result = await onRequestGet(context('2/properties'));
  expect(result.status).toBe(200);
  expect(fetcher.mock.calls[0][0]).toBe(
    'https://skies.esac.esa.int/JWST/NIRCam_Imaging/properties',
  );
  expect(result.headers.get('cache-control')).toContain('86400');
});

it('reports upstream failure without caching a substitute image', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Maintenance</html>')));
  const result = await onRequestGet(context('0/properties'));
  expect(result.status).toBe(503);
  expect(result.headers.get('cache-control')).toBe('no-store');
});
