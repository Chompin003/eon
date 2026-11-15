import { afterEach, expect, it, vi } from 'vitest';
import { onRequestGet } from '../functions/api/observations';

afterEach(() => vi.unstubAllGlobals());
it('rejects incomplete, reversed and pre-mission temporal windows before contacting IRSA', async () => {
  const upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  for (const query of [
    'start=61000',
    'start=61000&end=60999',
    'start=50000&end=61000',
    'start=abc&end=61000',
  ]) {
    const response = await onRequestGet({
      request: new Request(`https://eon.example/api/observations?ra=60&dec=51&${query}`),
    });
    expect(response.status).toBe(400);
  }
  expect(upstream).not.toHaveBeenCalled();
});
it('passes validated MJD boundaries to the official archive', async () => {
  const upstream = vi.fn().mockResolvedValue(new Response('<VOTABLE/>'));
  vi.stubGlobal('fetch', upstream);
  const response = await onRequestGet({
    request: new Request('https://eon.example/api/observations?ra=60&dec=51&start=60900&end=61000'),
  });
  expect(response.status).toBe(200);
  const url = upstream.mock.calls[0][0] as URL;
  expect(url.origin).toBe('https://irsa.ipac.caltech.edu');
  expect(url.searchParams.get('TIME')).toBe('60900 61000');
});
