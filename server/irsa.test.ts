import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { imageHdu, position } from './irsa';
import { onRequestGet as cutout } from '../functions/api/cutout';
import { onRequestGet as observations } from '../functions/api/observations';

const card = (key: string, value: string) => `${key.padEnd(8)}= ${value}`.padEnd(80);
function header(cards: string[]) {
  return new TextEncoder().encode([...cards, 'END'.padEnd(80)].join('').padEnd(2880));
}
function concat(...buffers: Uint8Array[]) {
  const bytes = new Uint8Array(buffers.reduce((sum, b) => sum + b.length, 0));
  let offset = 0;
  for (const buffer of buffers) {
    bytes.set(buffer, offset);
    offset += buffer.length;
  }
  return bytes;
}

describe('IRSA science image boundary', () => {
  it('selects flux IMAGE instead of variance, preserving WCS cards and pixel bytes', () => {
    const primary = header([card('SIMPLE', 'T'), card('BITPIX', '8'), card('NAXIS', '0')]);
    const axes = [
      card('BITPIX', '-32'),
      card('NAXIS', '2'),
      card('NAXIS1', '2'),
      card('NAXIS2', '2'),
      card('PCOUNT', '0'),
      card('GCOUNT', '1'),
    ];
    const variance = header([
      card('XTENSION', "'IMAGE   '"),
      ...axes,
      card('EXTNAME', "'VARIANCE'"),
    ]);
    const wcs = card('CTYPE1', "'RA---TAN-SIP'");
    const image = header([
      card('XTENSION', "'IMAGE   '"),
      ...axes,
      card('EXTNAME', "'IMAGE'"),
      wcs,
      card('CRVAL1', '60.8109955'),
    ]);
    const pixels = new Uint8Array(2880);
    new DataView(pixels.buffer).setFloat32(0, 123.5, false);
    const result = imageHdu(concat(primary, variance, new Uint8Array(2880), image, pixels));
    expect(new TextDecoder().decode(result.slice(0, 80))).toMatch(/^SIMPLE/);
    expect(new TextDecoder().decode(result.slice(0, 2880))).toContain(wcs);
    expect(new DataView(result.buffer).getFloat32(2880, false)).toBe(123.5);
    expect(result.length).toBe(5760);
    expect(() => imageHdu(concat(primary, image, pixels).slice(0, -5))).toThrow('truncado');
  });
  it('round-trips a real 58x58 cutout without changing calibrated pixel bytes', () => {
    const real = readFileSync(new URL('../tests/fixtures/spherex/epoch-0.fits', import.meta.url));
    // Our output still has EXTNAME=IMAGE, so re-extraction keeps its real WCS/data.
    const result = imageHdu(real);
    expect(result.length).toBe(real.length);
    expect(new Uint8Array(result.slice(28800))).toEqual(new Uint8Array(real.slice(28800)));
  });
  it.each(['ra=&dec=0', 'ra=360&dec=0', 'ra=0&dec=90.1', 'ra=NaN&dec=0'])(
    'rejects invalid coordinates %s',
    (query) => {
      expect(() => position(new URLSearchParams(query))).toThrow('Coordenadas');
    },
  );
  it('rejects arbitrary URLs and invalid positions before any remote request', async () => {
    expect(
      (
        await cutout({
          request: new Request(
            'https://example.test/api/cutout?ra=1&dec=1&url=https://example.com/file.fits',
          ),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await observations({
          request: new Request('https://example.test/api/observations?ra=0&dec=99'),
        })
      ).status,
    ).toBe(400);
  });
});
