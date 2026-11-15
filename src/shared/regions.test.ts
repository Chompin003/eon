import { expect, it } from 'vitest';
import { validRegionSize } from './regions';
import { readLocation, writeLocation } from './location';
it('keeps old limits unless the extended mode is explicitly present and survives sharing', () => {
  expect(validRegionSize(0.02)).toBe(true);
  expect(validRegionSize(0.25)).toBe(true);
  expect(validRegionSize(1)).toBe(false);
  expect(validRegionSize(1, true)).toBe(true);
  expect(validRegionSize(1.01, true)).toBe(false);
  expect(validRegionSize(0.019, true)).toBe(false);
  expect(readLocation(new URL('https://eon.test/?ra=60&dec=51&size=1'))?.region).toBeUndefined();
  const state = readLocation(new URL('https://eon.test/?ra=60&dec=51&size=1&wide=1'))!;
  expect(state.region?.extended).toBe(true);
  expect(readLocation(writeLocation(new URL('https://eon.test/'), state))).toEqual(state);
});
