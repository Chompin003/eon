import { describe, it, expect } from 'vitest';
import { gaiaClass, parseSimbad, simbadClass } from './study';
describe('classification provenance', () => {
  it('abstains on missing and uncertain probabilities instead of manufacturing certainty', () => {
    expect(gaiaClass({ star: undefined, galaxy: undefined }).category).toBe('unknown');
    expect(gaiaClass({ star: 0.5, galaxy: 0.4, quasar: 0.1 }).category).toBe('unknown');
    expect(gaiaClass({ star: 0.01, galaxy: 0.98, quasar: 0.01 })).toEqual({
      category: 'galaxy',
      probability: 0.98,
    });
  });
  it('preserves SIMBAD types and missing astrometry', () => {
    const parsed = parseSimbad(
      JSON.stringify({
        metadata: ['main_id', 'ra', 'dec', 'otype', 'pmra', 'pmdec', 'description'].map((name) => ({
          name,
        })),
        data: [['NGC 1491', 60.81625, 51.315, 'HII', null, null, 'HII Region']],
      }),
    );
    expect(parsed.objects[0].category).toBe('nebula');
    expect(parsed.objects[0].pmra).toBeUndefined();
    expect(parsed.objects[0].probability).toBeUndefined();
    expect(simbadClass('Cl*')).toBe('cluster');
    expect(simbadClass('Q?')).toBe('unknown');
    expect(() => parseSimbad('{"error":"failed"}')).toThrow();
  });
});
