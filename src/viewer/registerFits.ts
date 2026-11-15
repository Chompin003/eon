import type { SkyRegion } from '../shared';
import { distortedPixel, type SipModel } from './sip';
import { regionGrid, tangentPlane } from './tangent';

export function readFitsImage(input: ArrayBuffer) {
  const bytes = new Uint8Array(input),
    decoder = new TextDecoder('ascii');
  const header: Record<string, string> = {};
  let start = 0;
  for (let cursor = 0; cursor + 80 <= bytes.length; cursor += 80) {
    const card = decoder.decode(bytes.subarray(cursor, cursor + 80));
    const key = card.slice(0, 8).trim();
    if (key === 'END') {
      start = Math.ceil((cursor + 80) / 2880) * 2880;
      break;
    }
    if (card[8] === '=') {
      const value = card.slice(10).trim();
      // A slash inside a quoted FITS value belongs to the value (e.g. MJy / sr).
      const quoted = /^'((?:[^']|'')*)'/.exec(value);
      header[key] = quoted ? quoted[1].replaceAll("''", "'").trim() : value.split('/')[0].trim();
    }
  }
  const num = (key: string, fallback = NaN) =>
    header[key] === undefined ? fallback : Number(header[key].replace(/D/i, 'E'));
  const width = num('NAXIS1'),
    height = num('NAXIS2');
  if (
    !start ||
    num('BITPIX') !== -32 ||
    num('NAXIS') !== 2 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    start + width * height * 4 > bytes.length
  )
    throw new Error('Recorte IMAGE FITS incompleto o no compatible.');
  if (!/^RA---TAN(-SIP)?$/.test(header.CTYPE1) || !/^DEC--TAN(-SIP)?$/.test(header.CTYPE2))
    throw new Error('La proyección de esta exposición no es TAN/SIP.');
  if ([header.CUNIT1, header.CUNIT2].some((unit) => unit && unit !== 'deg'))
    throw new Error('La WCS debe estar en grados.');
  const cd11 = num('CD1_1', num('PC1_1', 1) * num('CDELT1', 1)),
    cd12 = num('CD1_2', num('PC1_2', 0) * num('CDELT1', 1));
  const cd21 = num('CD2_1', num('PC2_1', 0) * num('CDELT2', 1)),
    cd22 = num('CD2_2', num('PC2_2', 1) * num('CDELT2', 1));
  const determinant = cd11 * cd22 - cd12 * cd21;
  const crpix1 = num('CRPIX1'),
    crpix2 = num('CRPIX2');
  const ra = num('CRVAL1'),
    dec = num('CRVAL2');
  if (
    ![determinant, crpix1, crpix2, ra, dec].every(Number.isFinite) ||
    Math.abs(determinant) < 1e-20
  )
    throw new Error('La calibración WCS del recorte es inválida.');
  const terms = (prefix: string): SipModel['a'] =>
    Object.entries(header).flatMap(([key]) => {
      const m = key.match(new RegExp(`^${prefix}_(\\d+)_(\\d+)$`));
      return m ? [[Number(m[1]), Number(m[2]), num(key)] as [number, number, number]] : [];
    });
  const sip: SipModel = { crpix1, crpix2, a: terms('A'), b: terms('B') };
  if (header.CTYPE1.endsWith('-SIP') && (!sip.a.length || !sip.b.length))
    throw new Error('Faltan coeficientes SIP.');
  const plane = tangentPlane(ra, dec),
    data = new DataView(input);
  const scale = num('BSCALE', 1),
    zero = num('BZERO', 0);
  return {
    width,
    height,
    header,
    pixelToWorld(x: number, y: number): [number, number] {
      const u = x + 1 - crpix1,
        v = y + 1 - crpix2;
      const term = (t: SipModel['a']) =>
        t.reduce((sum, [i, j, value]) => sum + value * u ** i * v ** j, 0);
      const px = u + term(sip.a),
        py = v + term(sip.b);
      return plane.planeToWorld(cd11 * px + cd12 * py, cd21 * px + cd22 * py);
    },
    pixel(x: number, y: number) {
      return data.getFloat32(start + (y * width + x) * 4, false) * scale + zero;
    },
    worldToPixel(lon: number, lat: number): [number, number] | undefined {
      const xy = plane.worldToPlane(lon, lat);
      if (!xy) return;
      const lx = (cd22 * xy[0] - cd12 * xy[1]) / determinant + crpix1;
      const ly = (-cd21 * xy[0] + cd11 * xy[1]) / determinant + crpix2;
      const p = distortedPixel(lx, ly, sip);
      return p ? [p[0] - 1, p[1] - 1] : undefined;
    },
  };
}

/** Register directly from original pixels: one interpolation, one fixed sky grid. */
export function registerFits(input: ArrayBuffer, region: SkyRegion) {
  const image = readFitsImage(input),
    grid = regionGrid(region);
  const pixels = new Float32Array(grid.size * grid.size);
  pixels.fill(NaN);
  let valid = 0;
  for (let y = 0; y < grid.size; y++)
    for (let x = 0; x < grid.size; x++) {
      const world = grid.pixelToWorld(x + 0.5, y + 0.5);
      const p = image.worldToPixel(world[0], world[1]);
      if (!p) continue;
      const x0 = Math.floor(p[0]),
        y0 = Math.floor(p[1]),
        dx = p[0] - x0,
        dy = p[1] - y0;
      let value = 0;
      for (const [sx, sy, weight] of [
        [x0, y0, (1 - dx) * (1 - dy)],
        [x0 + 1, y0, dx * (1 - dy)],
        [x0, y0 + 1, (1 - dx) * dy],
        [x0 + 1, y0 + 1, dx * dy],
      ]) {
        if (weight < 1e-10) continue;
        if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) {
          value = NaN;
          break;
        }
        value += image.pixel(sx, sy) * weight;
      }
      if (Number.isFinite(value)) {
        pixels[y * grid.size + x] = value;
        valid++;
      }
    }
  return { pixels, size: grid.size, coverage: valid / pixels.length };
}
