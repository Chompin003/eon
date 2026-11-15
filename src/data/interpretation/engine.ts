import {
  separationArcsec,
  type DetectedExposure,
  type FITSFrame,
  type PixelStudy,
  type RegionStudy,
  type SkyRegion,
  type SourceDetection,
} from '../../shared';
import { exampleObservations } from '../example';

export const REPORT_METHOD = 'eon-evidence-rules-1';
export const countText = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;
export const REPORT_LIMITS = {
  instrumentQuality: 'not-evaluated',
  physicalMotion: 'not-evaluated',
  brightnessVariability: 'not-evaluated',
  spectralClassification: 'not-evaluated',
  identity: 'not-confirmed',
} as const;
export interface ReportInput {
  region: SkyRegion;
  frames?: readonly FITSFrame[];
  dataset?: PixelStudy['dataset'];
  pixels?: PixelStudy;
  catalog?: RegionStudy;
}
export interface Finding {
  rule: string;
  text: string;
  evidence: readonly string[];
}
export interface ExposureEvidence {
  id: string;
  dateUtc: string;
  detections: number;
  retainedOf?: number;
  validPixelFraction?: number;
  sepFlagged: number;
  apertureFlagged: number;
  cutoutUrl?: string;
  archiveUrl?: string;
}
interface Measurement {
  frame: DetectedExposure;
  detection: SourceDetection;
}
export interface GroupEvidence {
  id: string;
  measurements: readonly Measurement[];
  distinctDates: number;
}
export interface RegionInterpretation {
  method: typeof REPORT_METHOD;
  region: SkyRegion;
  dataset?: PixelStudy['dataset'];
  mode: 'pixels' | 'catalog' | 'unavailable';
  summary: string;
  observations: Finding[];
  cautions: Finding[];
  exposures: ExposureEvidence[];
  groups: GroupEvidence[];
  parameters?: PixelStudy['parameters'];
  counts: {
    inSequence: number;
    analyzed: number;
    failed: number;
    omitted: number;
    detections: number;
    groups: number;
    multiDateGroups: number;
    candidate: number;
    ambiguous: number;
    unmatched: number;
    sepFlagged: number;
    apertureFlagged: number;
  };
  catalog?: {
    queriedAt: string;
    entries: number;
    records: RegionStudy['objects'];
    byProvider: { gaia: number; simbad: number };
    errors: readonly string[];
    truncated: boolean;
    associatedWithPixels: boolean;
  };
  catalogContextComplete: boolean;
  failures: readonly { frameId: string; message: string }[];
  limits: typeof REPORT_LIMITS;
}

export function sameReportRegion(a: SkyRegion, b: SkyRegion): boolean {
  const delta = Math.abs(a.longitude - b.longitude) % 360;
  return (
    Math.min(delta, 360 - delta) < 1e-7 &&
    Math.abs(a.latitude - b.latitude) < 1e-7 &&
    Math.abs(a.sizeDeg - b.sizeDeg) < 1e-7
  );
}

/** Only already authorized IMAGE cutouts and the three explicit real examples. */
export function evidenceLinks(url: string | undefined, frameId: string) {
  if (!url) return {};
  if (/^\/examples\/spherex\/epoch-[0-2]\.fits$/.test(url)) {
    const original = exampleObservations.find((o) => o.id === frameId);
    if (original && url.endsWith(`epoch-${exampleObservations.indexOf(original)}.fits`))
      return { cutoutUrl: url, archiveUrl: original.url };
    return {};
  }
  if (!url.startsWith('/api/cutout?')) return {};
  try {
    const parsed = new URL(url, 'https://eon.invalid'),
      original = parsed.searchParams.get('url');
    if (
      parsed.pathname === '/api/cutout' &&
      original &&
      new URL(original).href === original &&
      /^https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/spherex\/(dr1|qr3)\/level2\/[A-Za-z0-9_./-]+\.fits$/.test(
        original,
      )
    )
      return { cutoutUrl: url, archiveUrl: original };
  } catch {
    // A malformed reference is omitted, never made into a clickable URL.
  }
  return {};
}

export function buildInterpretation(input: ReportInput): RegionInterpretation {
  const counts: RegionInterpretation['counts'] = {
    inSequence: input.frames?.length ?? 0,
    analyzed: 0,
    failed: 0,
    omitted: 0,
    detections: 0,
    groups: 0,
    multiDateGroups: 0,
    candidate: 0,
    ambiguous: 0,
    unmatched: 0,
    sepFlagged: 0,
    apertureFlagged: 0,
  };
  const report: RegionInterpretation = {
    method: REPORT_METHOD,
    region: { ...input.region },
    dataset: input.dataset,
    mode: 'unavailable',
    summary: 'Todavía no hay datos analizados para esta región.',
    counts,
    observations: [],
    cautions: [],
    exposures: [],
    groups: [],
    failures: [],
    catalogContextComplete: false,
    limits: REPORT_LIMITS,
  };
  const add = (
    kind: 'observations' | 'cautions',
    rule: string,
    text: string,
    evidence: string[] = [],
  ) => report[kind].push({ rule, text, evidence });
  const catalog =
    input.catalog && sameReportRegion(input.region, input.catalog.region)
      ? input.catalog
      : undefined;
  if (catalog) {
    report.mode = 'catalog';
    report.catalog = {
      queriedAt: catalog.queriedAt,
      entries: catalog.objects.length,
      records: catalog.objects,
      byProvider: {
        gaia: catalog.objects.filter((o) => o.provider === 'Gaia DR3').length,
        simbad: catalog.objects.filter((o) => o.provider === 'SIMBAD').length,
      },
      errors: [...catalog.errors],
      truncated: catalog.truncated,
      associatedWithPixels: false,
    };
    report.summary = `${countText(catalog.objects.length, 'entrada de catálogo consultada', 'entradas de catálogo consultadas')}. Aún no hay mediciones de píxeles utilizables en este informe.`;
    add(
      'observations',
      'catalog-entries',
      `${countText(report.catalog.byProvider.gaia, 'entrada Gaia DR3', 'entradas Gaia DR3')} y ${report.catalog.byProvider.simbad} SIMBAD. Pueden incluir el mismo objeto; no son detecciones demostradas en SPHEREx.`,
      ['catalog'],
    );
    if (catalog.errors.length || catalog.truncated)
      add(
        'cautions',
        'catalog-partial',
        'Los catálogos están incompletos o algún proveedor falló. Una ausencia de contraparte no permite afirmar que el objeto sea nuevo.',
        ['catalog'],
      );
  }
  const pixels = input.pixels;
  const compatible =
    pixels &&
    input.frames &&
    pixels.dataset === input.dataset &&
    sameReportRegion(pixels.region, input.region) &&
    (!catalog || catalog.queriedAt === pixels.catalogQueriedAt);
  if (pixels && !compatible)
    add(
      'cautions',
      'stale-input',
      'Las mediciones disponibles pertenecen a otra selección o consulta. Repite Interpretar región; este informe no las mezcla con los datos actuales.',
    );
  if (compatible) {
    report.parameters = { ...pixels.parameters };
    report.catalogContextComplete = Boolean(
      catalog && !catalog.errors.length && !catalog.truncated,
    );
    if (report.catalog) report.catalog.associatedWithPixels = true;
    const expected = new Map(input.frames!.map((f) => [f.id, f]));
    const measured = new Map<string, Map<string, Measurement>>();
    let rejected = 0;
    for (const frame of pixels.frames) {
      const original = expected.get(frame.frameId);
      if (
        !original ||
        frame.inputUrl !== original.url ||
        !Number.isFinite(Date.parse(frame.dateUtc)) ||
        Date.parse(original.dateUtc) !== Date.parse(frame.dateUtc) ||
        measured.has(frame.frameId)
      ) {
        rejected++;
        continue;
      }
      const detections = new Map<string, Measurement>();
      for (const detection of frame.detections) {
        if (
          ![detection.longitude, detection.latitude].every(Number.isFinite) ||
          detection.longitude < 0 ||
          detection.longitude >= 360 ||
          Math.abs(detection.latitude) > 90 ||
          detections.has(detection.id)
        ) {
          rejected++;
          continue;
        }
        detections.set(detection.id, { frame, detection });
        counts.detections++;
        counts[
          detection.association === 'candidate'
            ? 'candidate'
            : detection.association === 'ambiguous'
              ? 'ambiguous'
              : 'unmatched'
        ]++;
        if (detection.flags !== 0) counts.sepFlagged++;
        if (detection.apertureFlags !== 0) counts.apertureFlagged++;
      }
      measured.set(frame.frameId, detections);
      report.exposures.push({
        id: frame.frameId,
        dateUtc: frame.dateUtc,
        detections: detections.size,
        retainedOf: frame.detectedCount,
        validPixelFraction:
          Number.isFinite(frame.coverage) && frame.coverage >= 0 && frame.coverage <= 1
            ? frame.coverage
            : undefined,
        sepFlagged: [...detections.values()].filter((m) => m.detection.flags !== 0).length,
        apertureFlagged: [...detections.values()].filter((m) => m.detection.apertureFlags !== 0)
          .length,
        ...evidenceLinks(
          frame.inputUrl === original.url ? frame.inputUrl : undefined,
          frame.frameId,
        ),
      });
    }
    const grouped = new Set<string>(),
      groupIds = new Set<string>();
    for (const track of pixels.tracks) {
      if (groupIds.has(track.id)) {
        rejected++;
        continue;
      }
      groupIds.add(track.id);
      const members: Measurement[] = [],
        frames = new Set<string>();
      for (const ref of track.measurements) {
        const member = measured.get(ref.frameId)?.get(ref.detectionId);
        const key = JSON.stringify([ref.frameId, ref.detectionId]);
        if (!member || frames.has(ref.frameId) || grouped.has(key)) {
          rejected++;
          continue;
        }
        members.push(member);
        frames.add(ref.frameId);
        grouped.add(key);
      }
      if (members.length)
        report.groups.push({
          id: track.id,
          measurements: members.sort(
            (a, b) => Date.parse(a.frame.dateUtc) - Date.parse(b.frame.dateUtc),
          ),
          distinctDates: new Set(members.map((m) => Date.parse(m.frame.dateUtc))).size,
        });
    }
    rejected += counts.detections - grouped.size;
    report.exposures.sort((a, b) => Date.parse(a.dateUtc) - Date.parse(b.dateUtc));
    report.groups.sort(
      (a, b) =>
        b.distinctDates - a.distinctDates ||
        b.measurements.length - a.measurements.length ||
        a.id.localeCompare(b.id),
    );
    counts.analyzed = report.exposures.length;
    counts.groups = report.groups.length;
    counts.multiDateGroups = report.groups.filter((g) => g.distinctDates > 1).length;
    counts.failed = pixels.failures.length;
    counts.omitted = pixels.omittedFrames;
    report.failures = pixels.failures.map((f) => ({ ...f }));
    if (counts.analyzed) {
      report.mode = 'pixels';
      report.summary = `${countText(counts.detections, 'detección retenida', 'detecciones retenidas')} en ${countText(counts.analyzed, 'exposición analizada', 'exposiciones analizadas')}; ${countText(counts.multiDateGroups, 'grupo enlazado', 'grupos enlazados')} en más de una fecha. No es un recuento de objetos únicos.`;
      add(
        'observations',
        'pixel-detections',
        `SEP midió ${countText(counts.detections, 'detección', 'detecciones')} con umbral ${pixels.parameters.threshold}σ y área mínima ${pixels.parameters.minArea} píxeles.`,
        report.exposures.map((f) => f.id),
      );
      add(
        'observations',
        'positional-recurrence',
        `${counts.multiDateGroups} de ${counts.groups} grupos ${counts.multiDateGroups === 1 ? 'tiene' : 'tienen'} mediciones en fechas distintas. El enlace es por proximidad; no confirma identidad ni movimiento físico.`,
        report.groups
          .filter((g) => g.distinctDates > 1)
          .slice(0, 6)
          .map((g) => g.id),
      );
      add(
        'observations',
        'counterparts',
        `${countText(counts.candidate, 'detección con asociación candidata', 'detecciones con asociación candidata')}, ${countText(counts.ambiguous, 'ambigua', 'ambiguas')} y ${counts.unmatched} sin contraparte en las respuestas usadas.`,
        ['pixel-associations'],
      );
      if (!counts.detections)
        add(
          'cautions',
          'no-detections',
          'No se retuvieron detecciones con estos parámetros. No significa que la región esté vacía.',
          report.exposures.map((f) => f.id),
        );
      if (!report.catalogContextComplete)
        add(
          'cautions',
          'catalog-context',
          'La consulta de catálogos usada no está disponible completa. Las contrapartes requieren revisión; no se infiere una clase física desde los píxeles.',
          ['pixel-associations'],
        );
      if (counts.sepFlagged || counts.apertureFlagged)
        add(
          'cautions',
          'sep-flags',
          `${countText(counts.sepFlagged, 'detección con banderas SEP', 'detecciones con banderas SEP')} y ${countText(counts.apertureFlagged, 'medición con banderas de apertura', 'mediciones con banderas de apertura')}; pueden coincidir. Revisa sus exposiciones.`,
          report.exposures.filter((f) => f.sepFlagged || f.apertureFlagged).map((f) => f.id),
        );
    }
    if (
      pixels.failures.length ||
      pixels.omittedFrames ||
      pixels.frames.some((f) => f.truncated) ||
      rejected
    )
      add(
        'cautions',
        'partial-measurements',
        `El análisis es parcial: ${countText(counts.failed, 'exposición fallida', 'exposiciones fallidas')}, ${countText(counts.omitted, 'omitida', 'omitidas')} y ${pixels.frames.filter((f) => f.truncated).length} con límite de detecciones. Se excluyen ${countText(rejected, 'registro o enlace inconsistente', 'registros o enlaces inconsistentes')}.`,
        ['analysis-input'],
      );
  }
  add(
    'cautions',
    'instrument-quality',
    'Calidad instrumental sin evaluar: este análisis usa IMAGE, sin FLAGS ni VARIANCE instrumentales, ni corrección de PSF o apertura. Cero banderas SEP no significa una exposición libre de problemas.',
    ['method'],
  );
  add(
    'cautions',
    'spectral-comparability',
    'Variabilidad de brillo y espectro sin evaluar: falta la longitud de onda efectiva por píxel y comparar bandas/PSF compatibles. Las señales entre exposiciones no son una curva de luz a banda fija.',
    ['method'],
  );
  add(
    'cautions',
    'motion-not-measured',
    'Movimiento físico sin evaluar: no se ha ajustado una trayectoria con incertidumbres. Un enlace posicional o un cambio de centroide no demuestra movimiento propio.',
    ['method'],
  );
  return report;
}

export function interpretGroup(report: RegionInterpretation, id: string) {
  const group = report.groups.find((g) => g.id === id);
  if (!group) return;
  const values = group.measurements;
  const candidateIds = new Set(values.flatMap((m) => m.detection.candidates.map((c) => c.id)));
  const ambiguous =
    values.some((m) => m.detection.association === 'ambiguous') || candidateIds.size > 1;
  const candidate = values[0].detection.candidates[0];
  const catalogObject = report.catalog?.records.find((o) => o.id === candidate?.id);
  const consistentCandidate =
    report.catalogContextComplete &&
    catalogObject &&
    candidate.name === catalogObject.name &&
    candidate.provider === catalogObject.provider &&
    candidate.category === catalogObject.category &&
    candidate.probability === catalogObject.probability &&
    !ambiguous &&
    candidateIds.size === 1 &&
    values.every(
      (m) => m.detection.association === 'candidate' && m.detection.candidates.length === 1,
    );
  const first = values[0],
    last = values.at(-1)!;
  const sepFlagged = values.filter((m) => m.detection.flags !== 0).length,
    apertureFlagged = values.filter((m) => m.detection.apertureFlags !== 0).length;
  const separation =
    values.length > 1 && group.distinctDates > 1
      ? separationArcsec(
          [first.detection.longitude, first.detection.latitude],
          [last.detection.longitude, last.detection.latitude],
        )
      : undefined;
  return {
    id,
    measurements: values.length,
    distinctDates: group.distinctDates,
    firstUtc: first.frame.dateUtc,
    lastUtc: last.frame.dateUtc,
    separationArcsec: separation,
    sepFlagged,
    apertureFlagged,
    nextStep:
      sepFlagged || apertureFlagged
        ? 'Revisa primero las exposiciones con banderas de extracción o apertura.'
        : ambiguous
          ? 'Compara las contrapartes por fecha y la resolución de las imágenes antes de asignar una identidad.'
          : !report.catalogContextComplete
            ? 'Completa o repite la consulta de catálogos antes de interpretar una ausencia de contraparte.'
            : group.distinctDates < 2
              ? 'Reúne otras fechas comparables; una sola fecha no permite evaluar continuidad temporal.'
              : !consistentCandidate
                ? 'Inspecciona las exposiciones y otros catálogos antes de tratar una ausencia de contraparte como un objeto nuevo.'
                : 'Revisa las exposiciones originales; para cuantificar cambios faltan bandas compatibles y evaluación instrumental.',
    counterpart: ambiguous
      ? ('ambiguous' as const)
      : consistentCandidate
        ? ('candidate' as const)
        : ('unresolved' as const),
    candidate: consistentCandidate ? candidate : undefined,
    interpretation: ambiguous
      ? 'Las contrapartes son ambiguas o cambian entre exposiciones. Conserva el grupo sin identificar.'
      : consistentCandidate
        ? `Las mediciones proponen la misma contraparte: ${candidate.name} (${candidate.provider}). Es una asociación candidata, no una identidad confirmada.`
        : 'No hay una contraparte consistente demostrada con los catálogos disponibles. Esto no demuestra un objeto nuevo.',
    evidence: values.map(({ frame, detection }) => ({
      frameId: frame.frameId,
      detectionId: detection.id,
      dateUtc: frame.dateUtc,
      longitude: detection.longitude,
      latitude: detection.latitude,
      apertureMean: detection.apertureMean,
      apertureError: detection.apertureError,
      unit: frame.bunit,
      sepFlags: detection.flags,
      apertureFlags: detection.apertureFlags,
      candidates: detection.candidates,
    })),
    limits: REPORT_LIMITS,
  };
}

/** Export the evidence, never the large internal lookup with repeated FITS results. */
export function exportInterpretation(report: RegionInterpretation, selected?: string) {
  const { groups, ...summary } = report;
  return {
    ...summary,
    groups: groups.map((g) => ({
      id: g.id,
      measurements: g.measurements.length,
      distinctDates: g.distinctDates,
      evidence: g.measurements.map(({ frame, detection }) => ({
        frameId: frame.frameId,
        detectionId: detection.id,
      })),
    })),
    selectedGroup: selected ? interpretGroup(report, selected) : undefined,
    evidenceDefinitions: {
      catalog: 'Filas conservadas de las respuestas consultadas, no objetos únicos ni detecciones SPHEREx. Un contexto completo solo significa respuestas sin fallo/truncamiento; no garantiza un inventario completo del cielo.',
      'pixel-associations':
        'Asociaciones candidatas guardadas con las detecciones; se cuentan por exposición.',
      'analysis-input':
        'Exposiciones de la secuencia, fallos, omisiones y límites declarados del análisis.',
      method:
        'Reglas explícitas sobre SEP e IMAGE; no se entrenó un modelo ni se realizó inferencia generativa.',
    },
  };
}
