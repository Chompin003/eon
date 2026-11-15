import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSurveyMetadata } from './spherex';

const recorded = readFileSync(
  new URL('../../tests/fixtures/spherex/properties', import.meta.url),
  'utf8',
);
describe('official SPHEREx cube metadata', () => {
  it('reads actual wavelength mapping and excludes the two documented blank channels', () => {
    const data = parseSurveyMetadata(recorded);
    expect(data.channels).toHaveLength(100);
    expect(data.channels.find((channel) => channel.frame === 62)?.wavelengthUm).toBe(3.293);
    expect(data.channels.some((channel) => channel.frame === 50 || channel.frame === 51)).toBe(
      false,
    );
    expect(data.pixelScaleArcsec).toBeCloseTo(12.88296, 5);
    expect(data.observationStart).toBe('2025-04-24');
    expect(data.observationEnd).toBe('2026-05-14');
  });
  it('fails explicitly if the upstream coordinate frame changes', () => {
    expect(() =>
      parseSurveyMetadata(recorded.replace(/hips_frame\s*=\s*equatorial/, 'hips_frame = galactic')),
    ).toThrow();
  });
});
