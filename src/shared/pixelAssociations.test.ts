import { describe, it, expect } from 'vitest';
import { associateDetections, linkDetections } from './pixelAssociations';
import { objectPosition, type StudyObject } from './study';
import type { SourceDetection, DetectedExposure } from './pixels';
const detection = (id: string, ra = 0): SourceDetection => ({
  id,
  longitude: ra,
  latitude: 0,
  x: 20,
  y: 20,
  a: 1,
  b: 1,
  theta: 0,
  fwhmArcsec: 6.15,
  pixelScaleArcsec: 6.15,
  peak: 10,
  area: 8,
  flags: 0,
  apertureFlags: 0,
  association: 'none',
  candidates: [],
  category: 'unknown',
});
const exposure = (id: string, mjd: number, detections: SourceDetection[]): DetectedExposure => ({
  frameId: id,
  dateUtc: new Date((mjd - 40587) * 86400000).toISOString(),
  mjd,
  bunit: 'MJy / sr',
  background: 1,
  noise: 0.1,
  coverage: 1,
  truncated: false,
  detections,
});
const star = (id: string, ra = 0): StudyObject => ({
  id,
  name: id,
  longitude: ra,
  latitude: 0,
  provider: 'Gaia DR3',
  referenceEpoch: 2016,
  category: 'star',
  probability: 0.99,
  description: '',
});
describe('associations of real pixel centroids', () => {
  it('abstains with several counterparts or one counterpart claimed by several detections', () => {
    const frame = exposure('a', 61000, [detection('d')]);
    const ambiguous = associateDetections(frame, [star('a'), star('b', 0.0001)]).detections[0];
    expect(ambiguous.association).toBe('ambiguous');
    expect(ambiguous.category).toBe('unknown');
    const split = associateDetections(
      { ...frame, detections: [detection('d1'), detection('d2', 0.0001)] },
      [star('a')],
    );
    expect(split.detections.every((d) => d.association === 'ambiguous')).toBe(true);
  });
  it('propagates catalog positions before matching and preserves an explicit candidate', () => {
    const object = { ...star('moving'), pmra: 1000, pmdec: 0 };
    const [ra, dec] = objectPosition(object, 2026);
    const frame = exposure('a', 61041, [{ ...detection('d', ra), latitude: dec }]);
    const found = associateDetections({ ...frame, dateUtc: '2026-01-01T12:00:00Z' }, [object])
      .detections[0];
    expect(found.association).toBe('candidate');
    expect(found.category).toBe('star');
    expect(found.candidates[0].probability).toBe(0.99);
    expect(found.candidates[0].distanceArcsec).toBeLessThan(0.1);
  });
  it('links isolated neighbors while refusing crossings, absent detections and failed exposures', () => {
    const a = exposure('a', 61000, [detection('a1', 359.9999)]),
      b = exposure('b', 61001, [detection('b1', 0.0001)]);
    expect(linkDetections([a, b])).toHaveLength(1);
    const crossing = { ...b, detections: [detection('b1'), detection('b2', 0.0001)] };
    expect(linkDetections([a, crossing])).toHaveLength(3);
    expect(linkDetections([a, b], 6.15, ['a', 'failed', 'b'])).toHaveLength(2);
    expect(linkDetections([a, exposure('empty', 61000.5, []), b])).toHaveLength(2);
  });
});
