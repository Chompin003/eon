import { fetchIrsa, position } from '../../server/irsa';

export async function onRequestGet({ request }: { request: Request }): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const { ra, dec } = position(params);
    const url = new URL('https://irsa.ipac.caltech.edu/SIA');
    url.searchParams.set('POS', `CIRCLE ${ra} ${dec} 0.0000001`);
    for (const collection of ['spherex_dr1', 'spherex_qr3', 'spherex_dr1_deep', 'spherex_qr3_deep'])
      url.searchParams.append('COLLECTION', collection);
    url.searchParams.set('MAXREC', '2000');
    const year = params.get('year');
    if (params.has('start') || params.has('end')) {
      const start = Number(params.get('start')),
        end = Number(params.get('end'));
      const first = Date.UTC(2025, 0, 1) / 86400000 + 40587;
      const last = Date.UTC(new Date().getUTCFullYear() + 1, 0, 1) / 86400000 + 40587;
      if (
        !params.get('start')?.trim() ||
        !params.get('end')?.trim() ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < first ||
        end > last ||
        start >= end
      )
        return new Response('Ventana temporal inválida.', { status: 400 });
      url.searchParams.set('TIME', `${start} ${end}`);
    }
    if (year) {
      if (
        !/^20\d{2}$/.test(year) ||
        Number(year) < 2025 ||
        Number(year) > new Date().getUTCFullYear()
      )
        return new Response('Año inválido.', { status: 400 });
      const start = Date.UTC(Number(year), 0, 1) / 86400000 + 40587;
      const end = Date.UTC(Number(year) + 1, 0, 1) / 86400000 + 40587;
      url.searchParams.set('TIME', `${start} ${end}`);
    }
    const response = await fetchIrsa(url, 45000);
    if (!response.ok)
      return new Response('IRSA no pudo consultar las exposiciones.', { status: 502 });
    return new Response(response.body, {
      headers: {
        'content-type': 'application/x-votable+xml; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-data-provider': 'NASA/IPAC IRSA SIA v2',
      },
    });
  } catch (error) {
    if (error instanceof RangeError) return new Response(error.message, { status: 400 });
    console.error(
      JSON.stringify({
        operation: 'observations',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response('No se pudo consultar IRSA. Revisa las coordenadas o reintenta.', {
      status: 502,
    });
  }
}
