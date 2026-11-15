/** Display-only compatibility adapter for SPHEREx TAN-SIP images.
 * Aladin 3.8.2's SIP reader misplaces these cutouts. Keep its standard TAN
 * projection, but undo the detector polynomial first, using bilinear sampling.
 * The downloaded scientific FITS remains untouched. No photometry is computed.
 * SIP definition: https://fits.gsfc.nasa.gov/registry/sip.html
 */
export interface SipModel {
  crpix1: number;
  crpix2: number;
  a: [number, number, number][];
  b: [number, number, number][];
}

function polynomial(terms: SipModel['a'], u: number, v: number): number {
  return terms.reduce((sum, [i, j, value]) => sum + value * u ** i * v ** j, 0);
}

/** FITS uses one-based pixel centers. Solve distorted + SIP = linear TAN. */
export function distortedPixel(x: number, y: number, model: SipModel): [number, number] | null {
  let px = x,
    py = y;
  for (let iteration = 0; iteration < 30; iteration++) {
    const u = px - model.crpix1,
      v = py - model.crpix2;
    const nx = x - polynomial(model.a, u, v),
      ny = y - polynomial(model.b, u, v);
    if (!Number.isFinite(nx + ny)) return null;
    if (Math.max(Math.abs(nx - px), Math.abs(ny - py)) < 1e-8) return [nx, ny];
    px = nx;
    py = ny;
  }
  return null;
}

export function displayFits(input: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(input);
  const decoder = new TextDecoder('ascii');
  const header: Record<string, string> = {};
  const cards: string[] = [];
  let headerEnd = 0;
  for (let cursor = 0; cursor + 80 <= bytes.length; cursor += 80) {
    const card = decoder.decode(bytes.subarray(cursor, cursor + 80));
    cards.push(card);
    const key = card.slice(0, 8).trim();
    if (key === 'END') {
      headerEnd = Math.ceil((cursor + 80) / 2880) * 2880;
      break;
    }
    if (card[8] === '=')
      header[key] = card.slice(10).split('/')[0].trim().replace(/^'|'$/g, '').trim();
  }
  if (!headerEnd) throw new Error('Cabecera FITS incompleta.');
  if (!header.CTYPE1?.endsWith('-SIP')) return input;
  const width = Number(header.NAXIS1),
    height = Number(header.NAXIS2);
  if (
    Number(header.BITPIX) !== -32 ||
    Number(header.NAXIS) !== 2 ||
    !Number.isInteger(width * height) ||
    width < 1 ||
    height < 1 ||
    headerEnd + width * height * 4 > input.byteLength
  )
    throw new Error('Imagen SPHEREx no admitida por el adaptador SIP.');
  const terms = (prefix: string): SipModel['a'] =>
    Object.entries(header).flatMap(([key, value]) => {
      const match = key.match(new RegExp(`^${prefix}_(\\d)_(\\d)$`));
      return match
        ? [[Number(match[1]), Number(match[2]), Number(value)] as [number, number, number]]
        : [];
    });
  const model: SipModel = {
    crpix1: Number(header.CRPIX1),
    crpix2: Number(header.CRPIX2),
    a: terms('A'),
    b: terms('B'),
  };
  if (!model.a.length || !model.b.length) throw new Error('Coeficientes SIP ausentes.');
  const output = bytes.slice();
  const source = new DataView(input),
    target = new DataView(output.buffer);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const pixel = distortedPixel(x + 1, y + 1, model);
      let value = NaN;
      if (pixel) {
        const px = pixel[0] - 1,
          py = pixel[1] - 1;
        const x0 = Math.floor(px),
          y0 = Math.floor(py),
          dx = px - x0,
          dy = py - y0;
        if (x0 >= 0 && y0 >= 0 && x0 + 1 < width && y0 + 1 < height) {
          value = 0;
          for (const [sx, sy, weight] of [
            [x0, y0, (1 - dx) * (1 - dy)],
            [x0 + 1, y0, dx * (1 - dy)],
            [x0, y0 + 1, (1 - dx) * dy],
            [x0 + 1, y0 + 1, dx * dy],
          ]) {
            if (weight > 1e-12)
              value += source.getFloat32(headerEnd + (sy * width + sx) * 4, false) * weight;
          }
        }
      }
      target.setFloat32(headerEnd + (y * width + x) * 4, value, false);
    }
  const encoder = new TextEncoder();
  cards.forEach((card, index) => {
    const key = card.slice(0, 8).trim();
    if (/^(A|B|AP|BP)_(ORDER|\d_\d)$/.test(key))
      output.set(encoder.encode(' '.repeat(80)), index * 80);
    if (key === 'CTYPE1' || key === 'CTYPE2')
      output.set(
        encoder.encode(`${key.padEnd(8)}= '${header[key].replace('-SIP', '')}'`.padEnd(80)),
        index * 80,
      );
  });
  return output.buffer;
}
