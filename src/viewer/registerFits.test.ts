import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import reference from '../../tests/fixtures/spherex/region-reference.json';
import { readFitsImage, registerFits } from './registerFits';
import { regionGrid, tangentPlane, gridCamera } from './tangent';

describe('common region grid, independently checked with Astropy and SciPy', () => {
  for (const exposure of reference.exposures)
    it(`registers ${exposure.fixture} without altering its original pixels or SIP`, () => {
      const file = readFileSync(
        new URL(`../../tests/fixtures/spherex/${exposure.fixture}`, import.meta.url),
      );
      const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
      const before = new Uint8Array(bytes).slice();
      const image = readFitsImage(bytes),
        grid = regionGrid(reference.region),
        result = registerFits(bytes, reference.region);
      expect(result.size).toBe(reference.size);
      expect(result.coverage * result.pixels.length).toBeCloseTo(exposure.validPixels, 5);
      for (const sample of exposure.samples) {
        const [ra, dec] = grid.pixelToWorld(sample.target[0] + 0.5, sample.target[1] + 0.5);
        expect(ra).toBeCloseTo(sample.world[0], 9);
        expect(dec).toBeCloseTo(sample.world[1], 9);
        const source = image.worldToPixel(ra, dec)!;
        expect(source[0]).toBeCloseTo(sample.source[0], 5);
        expect(source[1]).toBeCloseTo(sample.source[1], 5);
        const value = result.pixels[sample.target[1] * result.size + sample.target[0]];
        if (sample.flux === null) expect(Number.isNaN(value)).toBe(true);
        else expect(value).toBeCloseTo(sample.flux, 4);
      }
      expect(new Uint8Array(bytes)).toEqual(before);
    });
  it('keeps RA wrap and the poles finite and rejects the opposite hemisphere', () => {
    for (const center of [
      [359.999, -0.25],
      [12, 89.999],
      [320, -89.999],
    ]) {
      const plane = tangentPlane(center[0], center[1]);
      const world = plane.planeToWorld(0.01, -0.01),
        actual = plane.worldToPlane(...world)!;
      expect(actual[0]).toBeCloseTo(0.01, 9);
      expect(actual[1]).toBeCloseTo(-0.01, 9);
      expect(plane.worldToPlane((center[0] + 180) % 360, -center[1])).toBeUndefined();
    }
  });
  it('leaves a region outside the exposure empty without inventing pixels', () => {
    const file = readFileSync(
      new URL('../../tests/fixtures/spherex/epoch-0.fits', import.meta.url),
    );
    const result = registerFits(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
      { longitude: 180, latitude: -20, sizeDeg: 0.1 },
    );
    expect(result.coverage).toBe(0);
    expect(result.pixels.every(Number.isNaN)).toBe(true);
  });
  it('preserves true horizontal angular FOV while panning off the reference center', () => {
    const grid = regionGrid({ longitude: 359.9, latitude: 70, sizeDeg: 0.1 });
    for (const view of [
      { longitude: 359.9, latitude: 70, fov: 0.1 },
      { longitude: 355, latitude: 78, fov: 1 },
      { longitude: 30, latitude: 50, fov: 100 },
    ]) {
      const camera = gridCamera(grid, view)!;
      const a = grid.pixelToWorld(camera.center[0] - camera.span / 2, camera.center[1]);
      const b = grid.pixelToWorld(camera.center[0] + camera.span / 2, camera.center[1]);
      const r = Math.PI / 180;
      const cosine =
        Math.sin(a[1] * r) * Math.sin(b[1] * r) +
        Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r);
      expect(Math.acos(Math.max(-1, Math.min(1, cosine))) / r).toBeCloseTo(view.fov, 6);
    }
  });
});
