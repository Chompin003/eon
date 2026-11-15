import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, VIEW_LIMITS, normalizeView } from '../shared';
import { panView, wheelZoomFactor, zoomView } from './navigation';

describe('celestial navigation', () => {
  it('wraps across the longitude seam in both directions', () => {
    expect(normalizeView({ ...DEFAULT_VIEW, longitude: -721 }).longitude).toBe(359);
    expect(normalizeView({ ...DEFAULT_VIEW, longitude: 1081 }).longitude).toBe(1);
  });
  it('prevents pole flips and unsafe fields of view', () => {
    expect(panView(DEFAULT_VIEW, 0, 100000, 500).latitude).toBe(90);
    expect(panView(DEFAULT_VIEW, 0, -100000, 500).latitude).toBe(-90);
    expect(zoomView(DEFAULT_VIEW, 100).fov).toBe(100);
    expect(zoomView(DEFAULT_VIEW, 1e-9).fov).toBe(VIEW_LIMITS.minFov);
  });
  it('scales drag sensitivity with zoom and viewport size', () => {
    expect(panView({ longitude: 180, latitude: 12, fov: 50 }, 100, 50, 500)).toEqual({
      longitude: 170,
      latitude: 17,
      fov: 50,
    });
    expect(panView(DEFAULT_VIEW, 100, 0, 0).longitude).toBeGreaterThanOrEqual(0);
  });
  it('makes wheel zoom consistent across pixel, line, and page devices', () => {
    expect(wheelZoomFactor(16, 0, 500)).toBe(wheelZoomFactor(1, 1, 500));
    expect(wheelZoomFactor(500, 0, 500)).toBe(wheelZoomFactor(1, 2, 500));
    expect(zoomView(DEFAULT_VIEW, wheelZoomFactor(-100, 0, 500)).fov).toBeLessThan(
      DEFAULT_VIEW.fov,
    );
  });
  it('keeps a pinch anchored at a valid finite field of view', () => {
    const next = zoomView(DEFAULT_VIEW, 100 / 200);
    expect(zoomView(next, 200 / 100).fov).toBeCloseTo(DEFAULT_VIEW.fov, 10);
    expect(normalizeView({ longitude: NaN, latitude: Infinity, fov: NaN })).toEqual(DEFAULT_VIEW);
  });
});
