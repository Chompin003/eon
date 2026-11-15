import { describe, it, expect } from 'vitest';
import { readLocation, writeLocation } from './location';
describe('shared observing location', () => {
  it('round trips exact ICRS, region, exposure and display while preserving other URL fields', () => {
    const original = new URL(
      'https://eon.test/?project=study&ra=359.999999999&dec=-89.12&fov=0.004&band=0&band2=101&display=color&mix=1&size=0.1&cx=0.000001&cy=-89&epoch=2025W34_2B_0099_1:SPHEREx-D4#notes',
    );
    const state = readLocation(original)!;
    expect(state.exposure?.id).toBe('2025W34_2B_0099_1:SPHEREx-D4');
    expect(readLocation(writeLocation(original, state))).toEqual(state);
    expect(writeLocation(original, state).searchParams.get('project')).toBe('study');
    expect(writeLocation(original, state).hash).toBe('#notes');
  });
  it('rejects missing, infinite or out of range coordinates and arbitrary archive URLs', () => {
    for (const q of [
      'ra=&dec=0',
      'ra=NaN&dec=0',
      'ra=Infinity&dec=0',
      'ra=12&dec=91',
      'ra=-1&dec=0',
    ])
      expect(readLocation(new URL('https://eon.test/?' + q))).toBeUndefined();
    const safe = readLocation(
      new URL(
        'https://eon.test/?ra=360&dec=0&fov=-3&band=1.5&tel=https://bad.test&size=0.1&epoch=https://bad.test',
      ),
    )!;
    expect(safe.view.longitude).toBe(0);
    expect(safe.view.fov).toBe(10);
    expect(safe.band).toBe(62);
    expect(safe.telescope).toBeUndefined();
    expect(safe.exposure).toBeUndefined();
  });
});
