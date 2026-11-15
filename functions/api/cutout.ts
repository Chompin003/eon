import { fetchIrsa, streamedImageHdu, position } from '../../server/irsa';
import { cachedCutout, storeCutout } from '../../server/cache';

export async function onRequestGet({
  request,
  waitUntil,
}: {
  request: Request;
  waitUntil?: (work: Promise<unknown>) => void;
}): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    const { ra, dec } = position(params);
    const input = params.get('url') ?? '';
    // This endpoint cannot proxy arbitrary hosts or unrelated archive files.
    if (
      !/^https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/spherex\/(dr1|qr3)\/level2\/[A-Za-z0-9_./-]+\.fits$/.test(
        input,
      ) ||
      input.includes('..')
    )
      return new Response('Archivo no permitido.', { status: 400 });
    const size = Number(params.get('size') ?? 0.1);
    if (!Number.isFinite(size) || size < 0.02 || size > 0.4)
      return new Response('Campo de recorte inválido.', { status: 400 });
    const url = new URL(input);
    url.searchParams.set('center', `${ra},${dec}d`);
    url.searchParams.set('size', String(size));
    const existing = await cachedCutout(request);
    if (existing) return existing;
    const response = await fetchIrsa(url, 60000);
    if (!response.ok) return new Response('IRSA no pudo preparar el recorte.', { status: 502 });
    const image = await streamedImageHdu(response, 12 * 1024 * 1024);
    const output = new Response(image.buffer as ArrayBuffer, {
      headers: {
        'content-type': 'application/fits',
        'cache-control': 'public, max-age=86400',
        'x-data-provider': 'NASA/SPHEREx IRSA - IMAGE HDU - celestial WCS preserved',
      },
    });
    await storeCutout(request, output, waitUntil);
    return output;
  } catch (error) {
    if (error instanceof RangeError) return new Response(error.message, { status: 400 });
    console.error(
      JSON.stringify({
        operation: 'cutout',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return new Response(
      'No se pudo preparar la imagen científica. Reintenta o elige otra exposición.',
      { status: 502 },
    );
  }
}
