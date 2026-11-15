import { boundedBody, fetchIrsa, position } from '../../server/irsa';
import { cachedCutout, storeCutout } from '../../server/cache';

/** Fixed public providers only. No user-supplied SQL, remote URL or credentials. */
export async function onRequestGet(ctx: {
  request: Request;
  waitUntil: (work: Promise<unknown>) => void;
}): Promise<Response> {
  try {
    const q = new URL(ctx.request.url).searchParams;
    const { ra, dec } = position(q),
      size = Number(q.get('size'));
    const provider = q.get('provider');
    if (
      !Number.isFinite(size) ||
      size < 0.02 ||
      size > 0.25 ||
      !['gaia', 'simbad'].includes(provider ?? '')
    )
      return new Response('Región o proveedor inválido.', { status: 400 });
    const existing = await cachedCutout(ctx.request);
    if (existing) return existing;
    const radius = size / Math.SQRT2;
    const url =
      provider === 'gaia'
        ? new URL('https://irsa.ipac.caltech.edu/cgi-bin/Gator/nph-query')
        : new URL('https://simbad.harvard.edu/simbad/sim-tap/sync');
    if (provider === 'gaia') {
      url.search = new URLSearchParams({
        catalog: 'gaia_dr3_source',
        spatial: 'Cone',
        objstr: `${ra} ${dec}`,
        radius: String(radius * 3600),
        radunits: 'arcsec',
        outfmt: '3',
        outrows: '1001',
        selcols:
          'source_id,ra,dec,pmra,pmdec,ref_epoch,classprob_dsc_combmod_star,classprob_dsc_combmod_galaxy,classprob_dsc_combmod_quasar',
      }).toString();
    } else {
      const query = `SELECT TOP 1001 b.main_id,b.ra,b.dec,b.otype,b.pmra,b.pmdec,t.description FROM basic AS b LEFT JOIN otypedef AS t ON b.otype=t.otype WHERE 1=CONTAINS(POINT('ICRS',b.ra,b.dec),CIRCLE('ICRS',${ra},${dec},${radius}))`;
      url.search = new URLSearchParams({
        request: 'doQuery',
        lang: 'adql',
        format: 'json',
        query,
      }).toString();
    }
    const upstream =
      provider === 'gaia'
        ? await fetchIrsa(url, 30000)
        : await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'manual' });
    if (!upstream.ok) throw new Error(`${provider}: HTTP ${upstream.status}`);
    const bytes = await boundedBody(upstream, 2 * 1024 * 1024);
    const text = new TextDecoder().decode(bytes);
    // IRSA can report service errors in an HTTP 200 VOTable.
    if (
      (provider === 'gaia' &&
        (/name="QUERY_STATUS"\s+value="ERROR"/.test(text) || !text.includes('<TABLE'))) ||
      (provider === 'simbad' && !text.trimStart().startsWith('{'))
    )
      throw new Error('El catálogo rechazó la consulta o excede su límite.');
    const output = new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'content-type':
          provider === 'gaia'
            ? 'application/x-votable+xml; charset=utf-8'
            : 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=86400',
        'x-data-provider':
          provider === 'gaia' ? 'ESA Gaia DR3 via NASA/IPAC IRSA' : 'CDS SIMBAD via Harvard mirror',
      },
    });
    await storeCutout(ctx.request, output, (work) => ctx.waitUntil(work));
    return output;
  } catch (error) {
    if (error instanceof RangeError) return new Response(error.message, { status: 400 });
    console.error(
      JSON.stringify({
        operation: 'catalog',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response(
      'El catálogo no respondió o la región excede el límite. Reintenta o elige una zona menor.',
      { status: 502 },
    );
  }
}
