import { describe, expect, it } from 'vitest';
import type {
  DetectedExposure,
  FITSFrame,
  PixelStudy,
  RegionStudy,
  SourceDetection,
} from '../../shared';
import {
  buildInterpretation,
  evidenceLinks,
  exportInterpretation,
  interpretGroup,
  sameReportRegion,
} from './engine';

// Deliberately small unit inputs test decision rules, not astronomical accuracy.
const region = { longitude: 0, latitude: 0, sizeDeg: 0.1 };
const queriedAt = '2026-11-15T20:00:00.000Z';
const source = (id: string, dateUtc: string): FITSFrame => ({
  kind: 'fits',
  id,
  dateUtc,
  title: id,
  center: region,
  url: `/api/cutout?url=${encodeURIComponent(`https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/${id}.fits`)}&ra=0&dec=0&size=.15`,
});
const sources = [source('f1', '2025-08-22T00:00:00Z'), source('f2', '2026-08-22T00:00:00Z')];
const detection = (id: string, extra: Partial<SourceDetection> = {}): SourceDetection => ({
  id,
  longitude: 0.001,
  latitude: 0,
  x: 8,
  y: 8,
  a: 1,
  b: 1,
  theta: 0,
  fwhmArcsec: 10,
  pixelScaleArcsec: 6.15,
  peak: 2,
  area: 5,
  flags: 0,
  apertureMean: 1,
  apertureError: 0.1,
  apertureFlags: 0,
  association: 'none',
  candidates: [],
  category: 'unknown',
  ...extra,
});
const measured = (i: number, detections = [detection('d' + i)]): DetectedExposure => ({
  frameId: sources[i].id,
  dateUtc: sources[i].dateUtc,
  inputUrl: sources[i].url,
  mjd: Date.parse(sources[i].dateUtc) / 86400000 + 40587,
  background: 0,
  noise: 1,
  bunit: 'MJy/sr',
  coverage: 1,
  truncated: false,
  detections,
});
const pixels = (extra: Partial<PixelStudy> = {}): PixelStudy => ({
  method: 'SEP 1.4.1',
  region,
  frames: [measured(0), measured(1)],
  tracks: [
    {
      id: 'D0001',
      measurements: [
        { frameId: 'f1', detectionId: 'd0' },
        { frameId: 'f2', detectionId: 'd1' },
      ],
    },
  ],
  catalogQueriedAt: queriedAt,
  failures: [],
  omittedFrames: 0,
  seconds: 0.1,
  parameters: {
    threshold: 5,
    minArea: 5,
    associationRadiusArcsec: 6.15,
    trackingMarginArcsec: 1.5,
  },
  ...extra,
});
const catalog = (extra: Partial<RegionStudy> = {}): RegionStudy => ({
  region,
  objects: [],
  errors: [],
  truncated: false,
  queriedAt,
  ...extra,
});
const build = (p = pixels(), c: RegionStudy | undefined = catalog()) =>
  buildInterpretation({ region, frames: sources, pixels: p, catalog: c });
const candidate = {
  id: 'gaia:1',
  name: 'Gaia DR3 1',
  provider: 'Gaia DR3',
  category: 'star' as const,
  distanceArcsec: 1,
  probability: 0.99,
};
const catalogStar: RegionStudy['objects'][number] = {
  id: candidate.id,
  name: candidate.name,
  provider: 'Gaia DR3',
  longitude: 0.001,
  latitude: 0,
  referenceEpoch: 2016,
  category: 'star',
  probability: 0.99,
  description: 'Controlled unit-test catalog row',
};
const matchedCatalog = () => catalog({ objects: [catalogStar] });

describe('traceable interpretation, without scientific claims beyond the inputs', () => {
  it('counts per-exposure detections and groups without calling them unique objects', () => {
    const report = build();
    expect(report.counts).toMatchObject({
      analyzed: 2,
      detections: 2,
      groups: 1,
      multiDateGroups: 1,
    });
    expect(report.summary).toContain('No es un recuento de objetos únicos');
    expect(report.limits).toMatchObject({
      instrumentQuality: 'not-evaluated',
      physicalMotion: 'not-evaluated',
      brightnessVariability: 'not-evaluated',
      identity: 'not-confirmed',
    });
    expect(report.cautions.map((f) => f.rule)).toEqual(
      expect.arrayContaining([
        'instrument-quality',
        'spectral-comparability',
        'motion-not-measured',
      ]),
    );
  });
  it('does not turn zero SEP flags or a valid-pixel fraction into instrument quality or sky coverage', () => {
    const report = build();
    expect(report.exposures[0].validPixelFraction).toBe(1);
    expect(report.limits.instrumentQuality).toBe('not-evaluated');
    expect(report.cautions.find((c) => c.rule === 'instrument-quality')?.text).toContain(
      'Cero banderas SEP no significa',
    );
    expect(JSON.stringify(report)).not.toContain('skyCoverage');
  });
  it('keeps a 99% published Gaia class a positional candidate, not an identity probability', () => {
    const p = pixels({
      frames: [
        measured(0, [detection('d0', { association: 'candidate', candidates: [candidate] })]),
        measured(1, [detection('d1', { association: 'candidate', candidates: [candidate] })]),
      ],
    });
    const group = interpretGroup(build(p, matchedCatalog()), 'D0001')!;
    expect(group.counterpart).toBe('candidate');
    expect(group.candidate?.probability).toBe(0.99);
    expect(group.interpretation).toContain('no una identidad confirmada');
    expect(group.limits.identity).toBe('not-confirmed');
  });
  it('marks a changing counterpart as ambiguous across dates', () => {
    const p = pixels({
      frames: [
        measured(0, [detection('d0', { association: 'candidate', candidates: [candidate] })]),
        measured(1, [
          detection('d1', {
            association: 'candidate',
            candidates: [{ ...candidate, id: 'gaia:2', name: 'other' }],
          }),
        ]),
      ],
    });
    const group = interpretGroup(build(p), 'D0001')!;
    expect(group.counterpart).toBe('ambiguous');
    expect(group.candidate).toBeUndefined();
  });
  it('does not present an incomplete catalog as a consistent identification', () => {
    const p = pixels({
      frames: [
        measured(0, [detection('d0', { association: 'candidate', candidates: [candidate] })]),
        measured(1, [detection('d1', { association: 'candidate', candidates: [candidate] })]),
      ],
    });
    const report = build(p, catalog({ errors: ['SIMBAD no disponible'], truncated: true }));
    expect(report.catalogContextComplete).toBe(false);
    expect(interpretGroup(report, 'D0001')?.counterpart).toBe('unresolved');
    expect(report.cautions.map((f) => f.rule)).toContain('catalog-partial');
  });
  it('missing counterparts are not new-object discoveries', () => {
    expect(interpretGroup(build(), 'D0001')?.interpretation).toContain(
      'no demuestra un objeto nuevo',
    );
  });
  it('does not trust a stored candidate absent from or changed in the actual catalog snapshot', () => {
    const p = pixels({
      frames: [
        measured(0, [detection('d0', { association: 'candidate', candidates: [candidate] })]),
        measured(1, [detection('d1', { association: 'candidate', candidates: [candidate] })]),
      ],
    });
    for (const c of [catalog(), catalog({ objects: [{ ...catalogStar, probability: 0.8 }] })]) {
      const group = interpretGroup(build(p, c), 'D0001')!;
      expect(group.counterpart).toBe('unresolved');
      expect(group.candidate).toBeUndefined();
    }
  });
  it('keeps the actual catalog rows as evidence without merging providers into unique objects', () => {
    const c = catalog({
      objects: [
        catalogStar,
        { ...catalogStar, id: 'simbad:test', provider: 'SIMBAD', probability: undefined },
      ],
    });
    const report = buildInterpretation({ region, catalog: c });
    expect(report.catalog?.entries).toBe(2);
    expect(report.catalog?.byProvider).toEqual({ gaia: 1, simbad: 1 });
    expect(exportInterpretation(report).catalog?.records).toEqual(c.objects);
    expect(report.counts.detections).toBe(0);
  });
  it('rejects measurements from another region, dataset, sequence or catalog snapshot', () => {
    for (const p of [
      pixels({ region: { ...region, longitude: 1 } }),
      pixels({ dataset: 'ngc1491-example' }),
      pixels({ catalogQueriedAt: 'older' }),
    ]) {
      const report = build(p);
      expect(report.mode).toBe('catalog');
      expect(report.counts.analyzed).toBe(0);
      expect(report.cautions.map((f) => f.rule)).toContain('stale-input');
    }
    expect(
      buildInterpretation({ region, pixels: pixels(), catalog: catalog() }).counts.analyzed,
    ).toBe(0);
    expect(buildInterpretation({ region, frames: [], pixels: pixels() }).counts.analyzed).toBe(0);
  });
  it('reports only catalog entries when no measured sequence exists', () => {
    const report = buildInterpretation({ region, catalog: catalog() });
    expect(report.mode).toBe('catalog');
    expect(report.summary).toContain('Aún no hay mediciones de píxeles');
    expect(report.groups).toHaveLength(0);
  });
  it('does not attach old measurements to another cutout URL with the same observation ID', () => {
    const changedSources = sources.map((f, i) => (i === 0 ? { ...f, url: f.url + '&size=1' } : f));
    const report = buildInterpretation({
      region,
      frames: changedSources,
      pixels: pixels(),
      catalog: catalog(),
    });
    expect(report.counts.analyzed).toBe(1);
    expect(report.exposures.map((f) => f.id)).toEqual(['f2']);
    expect(report.counts.multiDateGroups).toBe(0);
    expect(report.cautions.map((f) => f.rule)).toContain('partial-measurements');
  });
  it('does not describe an empty extraction as an empty sky', () => {
    const report = build(pixels({ frames: [measured(0, [])], tracks: [] }));
    expect(report.counts.detections).toBe(0);
    expect(report.cautions.find((f) => f.rule === 'no-detections')?.text).toContain(
      'No significa que la región esté vacía',
    );
  });
  it('reports omitted dates, failures and capped detections as partial', () => {
    const report = build(
      pixels({
        omittedFrames: 5,
        failures: [{ frameId: 'f3', message: 'archivo' }],
        frames: [{ ...measured(0), truncated: true, detectedCount: 900 }, measured(1)],
      }),
    );
    expect(report.counts).toMatchObject({ failed: 1, omitted: 5 });
    expect(report.exposures[0].retainedOf).toBe(900);
    expect(report.cautions.map((f) => f.rule)).toContain('partial-measurements');
  });
  it('rejects wrong dates and dangling or duplicate links without inflating recurrence', () => {
    const p = pixels({
      tracks: [
        {
          id: 'D0001',
          measurements: [
            { frameId: 'f1', detectionId: 'd0' },
            { frameId: 'f1', detectionId: 'd0' },
            { frameId: 'f2', detectionId: 'absent' },
          ],
        },
      ],
    });
    const report = build(p);
    expect(report.groups[0].measurements).toHaveLength(1);
    expect(report.counts.multiDateGroups).toBe(0);
    expect(report.cautions.map((f) => f.rule)).toContain('partial-measurements');
    expect(
      build(pixels({ frames: [{ ...measured(0), dateUtc: sources[1].dateUtc }] })).counts.analyzed,
    ).toBe(0);
  });
  it('simultaneous exposures are not repeated temporal epochs', () => {
    const sameTime = sources.map((s) => ({ ...s, dateUtc: sources[0].dateUtc }));
    const report = buildInterpretation({
      region,
      frames: sameTime,
      catalog: catalog(),
      pixels: pixels({ frames: [measured(0), { ...measured(1), dateUtc: sources[0].dateUtc }] }),
    });
    expect(report.counts.analyzed).toBe(2);
    expect(report.counts.multiDateGroups).toBe(0);
    expect(interpretGroup(report, 'D0001')?.separationArcsec).toBeUndefined();
  });
  it('measures angular separation through RA zero without calling it proper motion', () => {
    const report = build(
      pixels({
        frames: [
          measured(0, [detection('d0', { longitude: 359.999 })]),
          measured(1, [detection('d1', { longitude: 0.001 })]),
        ],
      }),
    );
    expect(interpretGroup(report, 'D0001')?.separationArcsec).toBeCloseTo(7.2, 6);
    expect(interpretGroup(report, 'D0001')?.limits.physicalMotion).toBe('not-evaluated');
    expect(sameReportRegion(region, { ...region, longitude: 360 })).toBe(true);
  });
  it('counts SEP and aperture flags separately and retains their overlap', () => {
    const report = build(
      pixels({
        frames: [measured(0, [detection('d0', { flags: 8, apertureFlags: 16 })]), measured(1)],
      }),
    );
    expect(report.counts).toMatchObject({ sepFlagged: 1, apertureFlagged: 1 });
    expect(report.cautions.find((f) => f.rule === 'sep-flags')?.text).toContain('pueden coincidir');
  });
  it('prioritizes extraction problems before treating a consistent catalog candidate as interpretable', () => {
    const p = pixels({
      frames: [
        measured(0, [
          detection('d0', { flags: 8, association: 'candidate', candidates: [candidate] }),
        ]),
        measured(1, [detection('d1', { association: 'candidate', candidates: [candidate] })]),
      ],
    });
    const group = interpretGroup(build(p, matchedCatalog()), 'D0001')!;
    expect(group.counterpart).toBe('candidate');
    expect(group.nextStep).toContain('primero las exposiciones con banderas');
    expect(group.limits.instrumentQuality).toBe('not-evaluated');
  });
  it('exports rules, evidence and limits without mutating or duplicating input results', () => {
    const p = pixels(),
      original = JSON.stringify(p);
    const a = build(p),
      b = build(p);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const exported = exportInterpretation(a, 'D0001');
    expect(exported.groups[0]).toMatchObject({ id: 'D0001', measurements: 2, distinctDates: 2 });
    expect(exported.groups[0].evidence).toHaveLength(2);
    expect(exported.selectedGroup?.evidence).toHaveLength(2);
    expect(exported.exposures[0].archiveUrl).toContain('irsa.ipac.caltech.edu');
    expect(JSON.stringify(p)).toBe(original);
  });
});

it('only emits same-origin cutouts and fixed official provenance links', () => {
  expect(evidenceLinks(sources[0].url, 'f1').archiveUrl).toContain('/spherex/dr1/level2/');
  for (const url of [
    'javascript:alert(1)',
    'https://evil.test/file.fits',
    '/api/cutout?url=javascript:alert(1)',
    '/api/cutout?url=https://evil.test/file.fits',
    '/api/cutout?url=https://irsa.ipac.caltech.edu/ibe/data/spherex/dr1/level2/../../other.fits',
    '/examples/spherex/epoch-8.fits',
  ])
    expect(evidenceLinks(url, 'f1')).toEqual({});
});
