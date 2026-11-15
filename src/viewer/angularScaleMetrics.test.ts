import { expect, it } from 'vitest';
import { angularScale } from './angularScaleMetrics';
import { tangentPlane } from './tangent';
import type { SkyProjection } from '../shared';
function projection(scale: number, ra = 359.99, dec = 80): SkyProjection {
  const plane = tangentPlane(ra, dec);
  return {
    getSize: () => [1000, 800],
    getView: () => ({ longitude: ra, latitude: dec, fov: scale * 1000 }),
    pixelToWorld: (x, y) => plane.planeToWorld((500 - x) * scale, (400 - y) * scale),
    worldToPixel: () => undefined,
    subscribe: () => () => {},
  };
}
it('solves a true local angular length through a polar, RA-wrapping projection', () => {
  for (const pitch of [1 / 3600, 0.05]) {
    const p = projection(pitch),
      s = angularScale(p)!;
    const a = p.pixelToWorld(s.x, s.y)!,
      b = p.pixelToWorld(s.x - s.pixels, s.y)!;
    // Independent 3D angular distance, rather than the helper used by the scale.
    const vector = ([ra, dec]: [number, number]) => {
      const r = (ra * Math.PI) / 180,
        d = (dec * Math.PI) / 180;
      return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
    };
    const va = vector(a),
      vb = vector(b),
      dot = va.reduce((sum, v, i) => sum + v * vb[i], 0);
    const seconds = ((Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI) * 3600;
    expect(seconds).toBeCloseTo(s.seconds, 3);
    expect(s.pixels).toBeLessThanOrEqual(140);
  }
});
it('uses arcseconds for deep zoom, arcminutes for wider fields, and hides outside projection', () => {
  expect(angularScale(projection(0.00001))!.label).toContain('″');
  expect(angularScale(projection(0.01))!.label).toContain('′');
  expect(angularScale({ ...projection(0.01), pixelToWorld: () => undefined })).toBeUndefined();
});
