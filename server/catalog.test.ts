import { afterEach, describe, it, expect, vi } from 'vitest';
import { onRequestGet } from '../functions/api/catalog';
afterEach(() => vi.unstubAllGlobals());
const context = (query: string) => ({
  request: new Request('https://eon.test/api/catalog?' + query),
  waitUntil: () => {},
});
describe('bounded public catalog proxy', () => {
  it('rejects invalid inputs without requesting upstream data', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const q of [
      'provider=evil&ra=1&dec=1&size=.1',
      'provider=gaia&ra=NaN&dec=1&size=.1',
      'provider=gaia&ra=1&dec=1&size=5',
    ])
      expect((await onRequestGet(context(q))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses only the selected fixed provider and bounds service error responses', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('<VOTABLE><TABLE></TABLE></VOTABLE>'));
    vi.stubGlobal('fetch', fetch);
    const result = await onRequestGet(
      context('provider=gaia&ra=1&dec=1&size=.1&url=https://evil.test&query=DROP'),
    );
    expect(result.status).toBe(200);
    const url = fetch.mock.calls[0][0] as URL;
    expect(url.origin).toBe('https://irsa.ipac.caltech.edu');
    expect(url.searchParams.get('catalog')).toBe('gaia_dr3_source');
    expect(url.href).not.toContain('evil');
    fetch.mockResolvedValue(
      new Response('<VOTABLE><INFO name="QUERY_STATUS" value="ERROR"/></VOTABLE>'),
    );
    expect((await onRequestGet(context('provider=gaia&ra=1&dec=1&size=.1'))).status).toBe(502);
  });
});
