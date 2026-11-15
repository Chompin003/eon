import { boundedBody } from '../../../server/irsa';
import { cachedCutout, storeCutout } from '../../../server/cache';

const roots = ['HST/ACS/', 'HST/WFC3/', 'JWST/NIRCam_Imaging/', 'JWST/MIRI_Imaging/'];

/** Fixed ESA datasets only; bounded, cached tile transport, never an arbitrary proxy. */
export async function onRequestGet(ctx: {
  request: Request;
  params: { path: string | string[] };
  waitUntil: (work: Promise<unknown>) => void;
}): Promise<Response> {
  const parts = Array.isArray(ctx.params.path) ? ctx.params.path : ctx.params.path.split('/');
  const index = Number(parts.shift());
  const path = parts.join('/');
  const tile = /^Norder(\d{1,2})\/Dir(\d+)\/Npix(\d+)\.(jpg|png)$/.exec(path);
  const validTile =
    tile &&
    Number(tile[1]) <= 15 &&
    Number(tile[3]) < 12 * 4 ** Number(tile[1]) &&
    Number(tile[2]) === Math.floor(Number(tile[3]) / 10000) * 10000;
  if (
    !Number.isInteger(index) ||
    !roots[index] ||
    !(
      validTile ||
      ['properties', 'Moc.fits', 'Norder3/Allsky.jpg', 'Norder3/Allsky.png'].includes(path)
    )
  )
    return new Response('Tesela no válida.', { status: 400 });
  const cached = await cachedCutout(ctx.request);
  if (cached) return cached;
  try {
    const upstream = await fetch(`https://skies.esac.esa.int/${roots[index]}${path}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) throw Error(`ESA HTTP ${upstream.status}`);
    const bytes = await boundedBody(upstream, path === 'properties' ? 128 * 1024 : 8 * 1024 * 1024);
    const type = path.endsWith('.png')
      ? 'image/png'
      : path.endsWith('.jpg')
        ? 'image/jpeg'
        : path.endsWith('.fits')
          ? 'application/fits'
          : 'text/plain';
    if (new TextDecoder().decode(bytes.slice(0, 100)).trimStart().startsWith('<'))
      throw Error('ESA returned an error document');
    const response = new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    storeCutout(ctx.request, response, ctx.waitUntil);
    return response;
  } catch {
    return new Response('ESA no está disponible. Reintenta más tarde; SPHEREx sigue disponible.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    });
  }
}
