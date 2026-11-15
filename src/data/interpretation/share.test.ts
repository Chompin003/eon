import { describe, expect, it } from 'vitest';
import { buildInterpretation } from './engine';
import { createShareReport, reportViewUrl } from './share';
import { readLocation } from '../../shared';

const region = { longitude: 359.999, latitude: -0.25, sizeDeg: 0.5, extended: true };
const options = {
  origin: 'https://eon-visualizer.pages.dev',
  createdAtUtc: '2026-11-15T23:00:00Z',
};
describe('shareable interpretation evidence', () => {
  it('round trips precise region and extended mode without claiming an exact replay', () => {
    const report = buildInterpretation({ region });
    const url = new URL(reportViewUrl(report, options.origin));
    expect(readLocation(url)?.region).toEqual(region);
    const data = createShareReport(report, options);
    expect(data.text).toContain('No restaura el informe');
    expect(data.text).toContain('sin datos analizables');
    expect(data.text).toContain('Sin parámetros de extracción');
    expect(data.snapshot.createdAtUtc).toBe(options.createdAtUtc);
    expect(data.snapshot.groupReports).toEqual([]);
    expect(() => reportViewUrl(report, 'javascript:alert(1)')).toThrow();
  });
  it('keeps incomplete catalog evidence and escapes hostile catalogue text in offline HTML', () => {
    const report = buildInterpretation({
      region,
      catalog: {
        region,
        objects: [],
        queriedAt: options.createdAtUtc,
        errors: ['<img src=x onerror="alert(1)"><script>alert(2)</script>'],
        truncated: true,
      },
    });
    const data = createShareReport(report, options);
    expect(data.text).toContain('solo catálogos; NO hay imágenes analizadas');
    expect(data.text).toContain('Respuesta truncada: sí');
    expect(data.snapshot.catalog?.errors).toEqual(report.catalog?.errors);
    expect(data.html).toContain('&lt;script&gt;');
    expect(data.html).not.toContain('<script>');
    expect(data.html).not.toContain('<img');
    expect(data.html).toContain("default-src 'none'");
    expect(data.html).toContain('Guardar como PDF');
    expect(data.text).toContain('SIN EVALUAR');
  });
});
