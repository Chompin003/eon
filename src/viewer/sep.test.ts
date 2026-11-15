import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { detectFits, type SepModule } from './sep';
import { readFitsImage } from './registerFits';
import reference from '../../tests/fixtures/spherex/sep-reference.json';
const url = new URL('../../public/vendor/sep/sep.mjs', import.meta.url).href;
const factory = (await import(/* @vite-ignore */ url)).default;
const lib: SepModule = await factory({
  wasmBinary: readFileSync(new URL('../../public/vendor/sep/sep.wasm', import.meta.url)),
});
describe('SEP WASM against independent Python SEP and Astropy', () => {
  for (const record of reference.exposures)
    it(record.file, async () => {
      const file = readFileSync(
        new URL('../../tests/fixtures/spherex/' + record.file, import.meta.url),
      );
      const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        before = new Uint8Array(bytes).slice();
      // Wide enough to include the full small official cutout, including its margin.
      const result = await detectFits(
        bytes,
        { longitude: 60.8109955, latitude: 51.3404038, sizeDeg: 0.25 },
        record.file,
        '2025-08-22T00:00:00Z',
        5,
        lib,
      );
      expect(result.background).toBeCloseTo(record.background, 5);
      expect(result.noise).toBeCloseTo(record.noise, 5);
      expect(result.bunit).toBe('MJy / sr');
      expect(result.detections).toHaveLength(record.objects.length);
      const image = readFitsImage(bytes);
      for (let i = 0; i < record.objects.length; i++) {
        const actual = result.detections[i],
          expected = record.objects[i];
        expect(actual.x).toBeCloseTo(expected.x, 5);
        expect(actual.y).toBeCloseTo(expected.y, 5);
        expect(actual.a).toBeCloseTo(expected.a, 5);
        expect(actual.b).toBeCloseTo(expected.b, 5);
        expect(actual.peak).toBeCloseTo(expected.peak, 4);
        expect(actual.area).toBe(expected.npix);
        expect(actual.flags).toBe(expected.flags);
        expect(actual.longitude).toBeCloseTo(expected.ra, 8);
        expect(actual.latitude).toBeCloseTo(expected.dec, 8);
        expect(image.worldToPixel(actual.longitude, actual.latitude)![0]).toBeCloseTo(actual.x, 5);
        expect(actual.apertureMean).toBeCloseTo(expected.mean, 4);
        expect(actual.apertureError).toBeCloseTo(expected.error, 4);
        expect(actual.apertureFlags).toBe(expected.apertureFlags);
      }
      expect(new Uint8Array(bytes)).toEqual(before);
    });
});
