export function position(params: URLSearchParams) {
  const ra = Number(params.get('ra'));
  const dec = Number(params.get('dec'));
  if (
    !params.get('ra')?.trim() ||
    !params.get('dec')?.trim() ||
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    ra < 0 ||
    ra >= 360 ||
    dec < -90 ||
    dec > 90
  )
    throw new RangeError('Coordenadas inválidas.');
  return { ra, dec };
}

/** IRSA documents transient read failures. Retry server throttling/errors,
 * retaining one total deadline and never following an arbitrary redirect. */
export async function fetchIrsa(url: URL, timeoutMs: number): Promise<Response> {
  const signal = AbortSignal.timeout(timeoutMs);
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { signal, redirect: 'manual' });
    if (attempt >= 2 || (response.status !== 429 && response.status < 500)) return response;
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
  }
}

/** Cap reads before buffering; IRSA cutouts normally occupy much less than 12 MB. */
export async function boundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new Error('IRSA devolvió un archivo vacío.');
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel();
    throw new Error('El recorte excede el tamaño permitido.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('El recorte excede el tamaño permitido.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

/** Stop the upstream transfer after IMAGE. IRSA cutouts also contain an uncut
 * PSF table, which can dwarf a small image and is not used by the visualizer. */
export async function streamedImageHdu(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new Error('IRSA devolvió un archivo vacío.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder('ascii');
  let bytes = new Uint8Array(32768),
    length = 0;
  const imageEnd = () => {
    let offset = 0;
    while (offset < length) {
      const keys: Record<string, string> = {};
      let cursor = offset,
        found = false;
      for (; cursor + 80 <= length; cursor += 80) {
        const card = decoder.decode(bytes.subarray(cursor, cursor + 80)),
          key = card.slice(0, 8).trim();
        if (key === 'END') {
          cursor += 80;
          found = true;
          break;
        }
        if (card[8] === '=')
          keys[key] = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
      }
      if (!found) return;
      const headerSize = Math.ceil((cursor - offset) / 2880) * 2880,
        naxis = Number(keys.NAXIS),
        bitpix = Math.abs(Number(keys.BITPIX));
      if (!Number.isInteger(naxis) || naxis < 0 || naxis > 9 || ![8, 16, 32, 64].includes(bitpix))
        throw new Error('Estructura FITS no admitida.');
      let count = naxis === 0 ? 0 : 1;
      for (let axis = 1; axis <= naxis; axis++) count *= Number(keys[`NAXIS${axis}`]);
      const dataSize = (bitpix / 8) * (count + Number(keys.PCOUNT ?? 0)) * Number(keys.GCOUNT ?? 1);
      if (!Number.isSafeInteger(dataSize) || dataSize < 0) throw new Error('Tamaño FITS inválido.');
      const end = offset + headerSize + Math.ceil(dataSize / 2880) * 2880;
      if (end > maxBytes) throw new Error('El recorte excede el tamaño permitido.');
      if (keys.EXTNAME === 'IMAGE' && naxis === 2) return end;
      if (end > length) return;
      offset = end;
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const take = Math.min(value.byteLength, maxBytes - length);
      if (length + take > bytes.length) {
        const grown = new Uint8Array(Math.min(maxBytes, Math.max(length + take, bytes.length * 2)));
        grown.set(bytes.subarray(0, length));
        bytes = grown;
      }
      bytes.set(value.subarray(0, take), length);
      length += take;
      const end = imageEnd();
      if (end !== undefined && length >= end) {
        await reader.cancel().catch(() => {});
        return imageHdu(bytes.subarray(0, end));
      }
      if (length >= maxBytes) throw new Error('El recorte excede el tamaño permitido.');
    }
    return imageHdu(bytes.subarray(0, length));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Extract the IMAGE HDU byte-for-byte, preserving its celestial WCS and SIP.
 * Other extensions (variance/flags/zodiacal model) must never be shown as flux.
 * This is FITS block framing only; no astrometry or pixel resampling here.
 */
export function imageHdu(bytes: Uint8Array): Uint8Array {
  const decoder = new TextDecoder('ascii');
  let offset = 0;
  while (offset < bytes.length) {
    const cards: string[] = [];
    const keywords: Record<string, string> = {};
    let end = false;
    let cursor = offset;
    for (; cursor + 80 <= bytes.length; cursor += 80) {
      const card = decoder.decode(bytes.subarray(cursor, cursor + 80));
      cards.push(card);
      const key = card.slice(0, 8).trim();
      if (key === 'END') {
        end = true;
        cursor += 80;
        break;
      }
      if (card[8] === '=')
        keywords[key] = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
    }
    if (!end) throw new Error('Cabecera FITS incompleta.');
    const headerSize = Math.ceil((cursor - offset) / 2880) * 2880;
    const dimensions = Number(keywords.NAXIS);
    const bitpix = Math.abs(Number(keywords.BITPIX));
    if (
      !Number.isInteger(dimensions) ||
      dimensions < 0 ||
      dimensions > 9 ||
      ![8, 16, 32, 64].includes(bitpix)
    )
      throw new Error('Estructura FITS no admitida.');
    let count = dimensions === 0 ? 0 : 1;
    for (let axis = 1; axis <= dimensions; axis++) count *= Number(keywords[`NAXIS${axis}`]);
    const dataSize =
      (bitpix / 8) * (count + Number(keywords.PCOUNT ?? 0)) * Number(keywords.GCOUNT ?? 1);
    if (!Number.isSafeInteger(dataSize) || dataSize < 0) throw new Error('Tamaño FITS inválido.');
    const padded = Math.ceil(dataSize / 2880) * 2880;
    if (offset + headerSize + padded > bytes.length) throw new Error('Archivo FITS truncado.');
    if (keywords.EXTNAME === 'IMAGE' && dimensions === 2) {
      const output = bytes.slice(offset, offset + headerSize + padded);
      const encoder = new TextEncoder();
      // Make a standard standalone primary image for Aladin, retaining all WCS cards.
      output.set(encoder.encode('SIMPLE  =                    T'.padEnd(80)), 0);
      for (let i = 1; i < cards.length; i++) {
        if (['PCOUNT', 'GCOUNT', 'XTENSION'].includes(cards[i].slice(0, 8).trim()))
          output.set(encoder.encode(' '.repeat(80)), i * 80);
      }
      return output;
    }
    offset += headerSize + padded;
  }
  throw new Error('El FITS no contiene una extensión IMAGE bidimensional.');
}
