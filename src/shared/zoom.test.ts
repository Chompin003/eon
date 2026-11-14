import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, VIEW_LIMITS } from './contracts';
import { fovToZoomPosition, opticalZoom, zoomPositionToFov } from './zoom';

describe('deep optical zoom', () => {
  it('covers 100 degrees through one arcsecond without losing the endpoints', () => {
    expect(zoomPositionToFov(0)).toBeCloseTo(100, 10);
    expect(zoomPositionToFov(1000)).toBeCloseTo(1 / 3600, 12);
    expect(opticalZoom(VIEW_LIMITS.minFov)).toBeGreaterThan(490000);
  });
  it('keeps slider round trips precise across the whole range', () => {
    for (const fov of [100, 75, 1, 1 / 60, 1 / 3600]) {
      expect(zoomPositionToFov(fovToZoomPosition(fov))).toBeCloseTo(fov, 10);
    }
  });
  it('makes every slider step optically proportional', () => {
    const a = opticalZoom(zoomPositionToFov(200));
    const b = opticalZoom(zoomPositionToFov(400));
    const c = opticalZoom(zoomPositionToFov(600));
    expect(b / a).toBeCloseTo(c / b, 10);
    expect(fovToZoomPosition(DEFAULT_VIEW.fov)).toBeGreaterThan(0);
  });
});
