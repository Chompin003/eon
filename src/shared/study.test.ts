import { describe, it, expect } from 'vitest';
import { inStudyRegion, objectPosition, type StudyObject } from './study';
const source: StudyObject = {
  id: 'test',
  name: 'test',
  provider: 'Gaia DR3',
  longitude: 359.999,
  latitude: 89.9,
  referenceEpoch: 2016,
  pmra: 1000,
  pmdec: -500,
  category: 'unknown',
  description: '',
};
describe('catalog positions', () => {
  it('keeps catalog coordinates immutable and handles RA wrap near the pole', () => {
    const at = objectPosition(source, 2026);
    // Independent Astropy/ERFA apply_space_motion, no radial velocity/distance.
    expect(at[0]).toBeCloseTo(1.568355622923445, 6);
    expect(at[1]).toBeCloseTo(89.89857306653862, 6);
    expect(at[0]).toBeGreaterThan(0);
    expect(at[0]).toBeLessThan(2);
    expect(at[1]).toBeLessThan(source.latitude);
    expect(objectPosition(source, 2016)[0]).toBeCloseTo(source.longitude, 10);
    expect(source.longitude).toBe(359.999);
    expect(objectPosition({ ...source, pmdec: undefined }, 2026)).toEqual([
      source.longitude,
      source.latitude,
    ]);
  });
  it('filters the exact TAN square rather than its bounding query circle', () => {
    const region = { longitude: 359.99, latitude: 70, sizeDeg: 0.1 };
    expect(inStudyRegion(0.01, 70, region)).toBe(true);
    expect(inStudyRegion(359.99, 70.06, region)).toBe(false);
    expect(inStudyRegion(180, 70, region)).toBe(false);
  });
});
