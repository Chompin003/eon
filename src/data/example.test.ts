import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import manifest from '../../public/examples/spherex/manifest.json';
import { exampleFrames } from './example';
describe('explicit real example provenance', () => {
  it('ships byte-identical scientific IMAGE files and catalog snapshots with valid hashes', () => {
    for (const file of [...manifest.frames, ...manifest.catalogs]) {
      const bytes = readFileSync(
        new URL('../../public/examples/spherex/' + file.file, import.meta.url),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    }
    expect(exampleFrames.every((f) => f.dataset === 'ngc1491-example')).toBe(true);
    for (const f of manifest.frames)
      expect(Math.abs(Date.parse(f.dateUtc) - (f.mjd - 40587) * 86400000)).toBeLessThanOrEqual(1);
  });
});
