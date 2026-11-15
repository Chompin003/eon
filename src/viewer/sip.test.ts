import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import provenance from '../../tests/fixtures/spherex/provenance.json';
import { displayFits, distortedPixel, type SipModel } from './sip';

describe('SPHEREx SIP display adapter', () => {
  it('agrees with independent Astropy/WCSLIB inverse transforms across a real cutout', () => {
    const model = provenance.sipModel as SipModel;
    for (const sample of provenance.sipAstropyCases) {
      const actual = distortedPixel(sample.linearFits[0], sample.linearFits[1], model)!;
      expect(actual[0]).toBeCloseTo(sample.distortedFits[0], 6);
      expect(actual[1]).toBeCloseTo(sample.distortedFits[1], 6);
    }
  });
  it('creates a separate TAN display image while retaining the original scientific bytes', () => {
    const original = readFileSync(
      new URL('../../tests/fixtures/spherex/epoch-0.fits', import.meta.url),
    );
    const input = original.buffer.slice(
      original.byteOffset,
      original.byteOffset + original.byteLength,
    );
    const before = new Uint8Array(input).slice();
    const output = displayFits(input);
    expect(new Uint8Array(input)).toEqual(before);
    expect(output).not.toBe(input);
    const text = new TextDecoder().decode(new Uint8Array(output).slice(0, 28800));
    expect(text).toContain("'RA---TAN'");
    expect(text).not.toContain('A_ORDER');
  });
});
