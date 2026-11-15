import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { onRequestGet as cutout } from '../functions/api/cutout';
import { onRequestGet as observations } from '../functions/api/observations';
import { onRequestGet as catalog } from '../functions/api/catalog';
import provenance from '../tests/fixtures/spherex/wide-provenance.json';
afterEach(() => vi.unstubAllGlobals());
it('requires the opt-in parameter for larger SIA regions and still bounds it', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('<VOTABLE/>')));
  vi.stubGlobal('fetch', fetch);
  const run = (q: string) =>
    observations({ request: new Request('https://eon.test/api/observations?ra=60&dec=51&' + q) });
  expect((await run('radius=.7')).status).toBe(400);
  expect((await run('radius=.8&extended=1')).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
  expect((await run('radius=.7&extended=1')).status).toBe(200);
});
it('permits a bounded large catalog only with opt-in, retaining fixed providers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('<VOTABLE><TABLE/></VOTABLE>'));
  vi.stubGlobal('fetch', fetch);
  const run = (q: string) =>
    catalog({
      request: new Request('https://eon.test/api/catalog?provider=gaia&ra=60&dec=51&' + q),
      waitUntil: () => {},
    });
  expect((await run('size=1')).status).toBe(400);
  expect((await run('size=1.01&extended=1')).status).toBe(400);
  expect((await run('size=1&extended=1')).status).toBe(200);
  expect((fetch.mock.calls[0][0] as URL).hostname).toBe('irsa.ipac.caltech.edu');
});
it('serves the original large IMAGE bytes with a bounded 1.5 degree margin', async () => {
  const data = readFileSync(new URL('../tests/fixtures/spherex/wide-epoch.fits', import.meta.url));
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(data)));
  vi.stubGlobal('fetch', fetch);
  const original = new URL(provenance.url);
  original.search = '';
  const run = (size: string, opt = '') =>
    cutout({
      request: new Request(
        'https://eon.test/api/cutout?' +
          new URLSearchParams({
            ra: '60.8109955',
            dec: '51.3404038',
            url: String(original),
            size,
            ...(opt ? { extended: opt } : {}),
          }),
      ),
    });
  expect((await run('1')).status).toBe(400);
  expect((await run('1.6', '1')).status).toBe(400);
  const result = await run('1.5', '1');
  expect(result.status).toBe(200);
  expect(Buffer.from(await result.arrayBuffer()).equals(data)).toBe(true);
});
