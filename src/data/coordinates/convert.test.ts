import { describe, expect, it } from 'vitest';
import { convertCoordinates, coordinateTarget, formatSexagesimal } from './convert';

describe('sexagesimal coordinates', () => {
  it('converts RA time with the factor 15 and preserves negative zero degrees', () => {
    const result = convertCoordinates('12 30 45.5', '-00 15 30');
    expect(result.ra).toBeCloseTo(187.68958333333333, 10);
    expect(result.dec).toBeCloseTo(-0.25833333333333336, 10);
    expect(convertCoordinates('00:00:00', '−00:30:00').dec).toBe(-0.5);
  });
  it('accepts decimal commas, positive signs and the exact poles', () => {
    expect(convertCoordinates('23:59:59,99', '+90 0 0').ra).toBeLessThan(360);
    expect(convertCoordinates('0 0 0', '-90 0 0').dec).toBe(-90);
  });
  it.each(['24 0 0', '-00 0 0', '12 60 0', '12 0 60', '', '12 30', 'NaN 0 0', '1.5 0 0'])(
    'rejects invalid RA %s',
    (ra) => {
      expect(() => convertCoordinates(ra, '0 0 0')).toThrow(/^RA:/);
    },
  );
  it.each([
    '91 0 0',
    '-91 0 0',
    '90 0 1',
    '-90 1 0',
    '0 60 0',
    '0 0 60',
    '',
    '0 -1 0',
    'Infinity 0 0',
  ])('rejects invalid Dec %s', (dec) => {
    expect(() => convertCoordinates('0 0 0', dec)).toThrow(/^Dec:/);
  });
  it('handles sexagesimal carry, RA wrap and negative subdegree formatting', () => {
    expect(formatSexagesimal(359.99999999999, 'ra')).toBe('00 00 00.000000');
    expect(formatSexagesimal(-0.5, 'dec')).toBe('-00 30 00.000000');
    expect(formatSexagesimal(12.99999999999, 'dec')).toBe('+13 00 00.000000');
  });
  it('retains numeric precision and zoom and supports the full declination range', () => {
    const view = { longitude: 180, latitude: 12, fov: 1 / 3600 };
    const { ra, dec } = convertCoordinates('12 30 45.123456789', '-00 15 30');
    expect(coordinateTarget(ra, dec, view)).toEqual({
      longitude: ra,
      latitude: dec,
      fov: view.fov,
    });
    expect(coordinateTarget(0, 85, view)?.latitude).toBe(85);
    expect(coordinateTarget(0, 90, view)?.latitude).toBe(90);
    expect(coordinateTarget(0, -90, view)?.latitude).toBe(-90);
    expect(coordinateTarget(0, 90.00001, view)).toBeNull();
    expect(view.latitude).toBe(12);
  });
});
