import { formatAngularSize } from '../../shared';
import { formatSexagesimal } from '../coordinates/convert';
import { exportInterpretation, interpretGroup, type RegionInterpretation } from './engine';

interface Section {
  title: string;
  paragraphs: string[];
}
export const SHARE_FORMAT = 'eon-readable-report-1';
const number = (n: number | undefined) =>
  n === undefined || !Number.isFinite(n) ? 'sin medida' : String(n);
const position = (ra: number, dec: number) =>
  `RA ${formatSexagesimal(ra, 'ra')} · Dec ${formatSexagesimal(dec, 'dec')} (ICRS/J2000); RA ${ra}°, Dec ${dec}°`;

/** The link restores a view, not an exact historical archive response. */
export function reportViewUrl(report: RegionInterpretation, origin: string) {
  const url = new URL('/', origin);
  if (!['https:', 'http:'].includes(url.protocol)) throw Error('Origen no permitido');
  const r = report.region;
  url.search = new URLSearchParams({
    ra: String(r.longitude),
    dec: String(r.latitude),
    fov: String(r.sizeDeg * 2),
    size: String(r.sizeDeg),
    ...(r.extended ? { wide: '1' } : {}),
    ...(report.dataset === 'ngc1491-example' ? { example: 'ngc1491' } : {}),
    ...(report.exposures[0] ? { epoch: report.exposures[0].id } : {}),
  }).toString();
  return url.href;
}

export function createShareReport(
  report: RegionInterpretation,
  options: { origin: string; createdAtUtc: string; selected?: string },
) {
  const viewUrl = reportViewUrl(report, options.origin);
  const snapshot = {
    createdAtUtc: options.createdAtUtc,
    readableFormat: SHARE_FORMAT,
    viewUrl,
    ...exportInterpretation(report, options.selected),
    // Preserve coordinates, photometry, flags and candidates for every group,
    // including those which were not selected in the interactive panel.
    groupReports: report.groups.map((g) => interpretGroup(report, g.id)!),
    groupMeasurements: report.groups.flatMap((g) =>
      g.measurements.map(({ frame, detection }) => ({
        groupId: g.id,
        frameId: frame.frameId,
        dateUtc: frame.dateUtc,
        mjd: frame.mjd,
        bunit: frame.bunit,
        background: frame.background,
        noise: frame.noise,
        detection,
      })),
    ),
  };
  const c = report.counts;
  const sections: Section[] = [
    {
      title: '1. Identificación y alcance',
      paragraphs: [
        `Exportado: ${options.createdAtUtc}. Método: ${report.method}. Formato: ${SHARE_FORMAT}.`,
        position(report.region.longitude, report.region.latitude),
        `Región cuadrada: ${formatAngularSize(report.region.sizeDeg)} de lado (${report.region.sizeDeg} grados); modo ${report.region.extended ? 'ampliado' : 'normal'}.`,
        `Origen: ${report.dataset ? 'ejemplo real NGC 1491 guardado; no es una consulta en vivo' : 'consulta de archivos y catálogos'}.`,
        `Alcance: ${report.mode === 'pixels' ? 'mediciones de píxeles originales IMAGE' : report.mode === 'catalog' ? 'solo catálogos; NO hay imágenes analizadas' : 'sin datos analizables'}.`,
        `Vista de la región: ${viewUrl}`,
        'Este enlace recupera centro, tamaño y una exposición de referencia. No restaura el informe, los catálogos históricos ni la selección exacta de todas las imágenes. Comparte también el JSON.',
      ],
    },
    {
      title: '2. Resultado y lectura correcta',
      paragraphs: [
        report.summary,
        `${c.analyzed} exposiciones analizadas de ${c.inSequence}; ${c.failed} fallidas; ${c.omitted} omitidas por el límite del analizador.`,
        `${c.detections} detecciones retenidas; ${c.groups} grupos posicionales; ${c.multiDateGroups} grupos en varias fechas. No son recuentos de objetos únicos confirmados.`,
        `Por detección: ${c.candidate} asociaciones candidatas, ${c.ambiguous} ambiguas y ${c.unmatched} sin coincidencia en las respuestas usadas.`,
        `${c.sepFlagged} detecciones con banderas SEP y ${c.apertureFlagged} con banderas de apertura; pueden coincidir.`,
        ...report.observations.map((f) => `[${f.rule}] ${f.text}`),
      ],
    },
    {
      title: '3. Límites y avisos',
      paragraphs: [
        'Calidad instrumental, movimiento físico, variabilidad de brillo y clasificación espectral: SIN EVALUAR. Identidad: NO CONFIRMADA. No se anuncian descubrimientos.',
        'Los marcadores de catálogo no son detecciones SPHEREx. Una candidatura cercana no confirma identidad; una ausencia de contraparte o detección no demuestra un objeto nuevo ni su ausencia física.',
        'La señal media en apertura mantiene la unidad del FITS: no es flujo integrado corregido. Diferentes exposiciones pueden medir longitudes de onda distintas; sus señales no constituyen una curva de luz a banda fija.',
        ...report.cautions.map((f) => `[${f.rule}] ${f.text}`),
        ...report.failures.map((f) => `Fallo ${f.frameId}: ${f.message}`),
      ],
    },
    {
      title: '4. Método y parámetros para repetir',
      paragraphs: [
        'SEP 1.4.1, compilado a WebAssembly, detecta y mide fuentes sobre IMAGE original en un Worker. WCS/SIP transforma centros de píxel a coordenadas. Las reglas locales versionadas resumen estas mediciones y las asociaciones de catálogo; no hay un modelo entrenado por Eon ni un modelo de lenguaje.',
        report.parameters
          ? `Umbral SEP: ${report.parameters.threshold} sigma sobre ruido local; área mínima: ${report.parameters.minArea} píxeles; radio de asociación de catálogo: ${report.parameters.associationRadiusArcsec} segundos de arco; margen de enlace entre exposiciones: ${report.parameters.trackingMarginArcsec} segundos de arco.`
          : 'Sin parámetros de extracción: no hay mediciones de píxeles utilizables.',
        'Las fechas de observación proceden de t_min (MJD UTC) de SIA; DATE del FITS puede indicar procesamiento. Los canales del mosaico no son fechas.',
        'La proyección TAN de pantalla y las anotaciones son visualización; el analizador usa los píxeles originales. No incorpora FLAGS/VARIANCE instrumentales ni correcciones completas de PSF/apertura.',
      ],
    },
    {
      title: '5. Exposiciones y archivos utilizados',
      paragraphs: report.exposures.length
        ? report.exposures.flatMap((f) => [
            `${f.id} | ${f.dateUtc} | ${f.detections} detecciones retenidas${f.retainedOf !== undefined ? ` de ${f.retainedOf} antes del límite` : ''}; fracción válida del recorte: ${number(f.validPixelFraction)}; banderas SEP: ${f.sepFlagged}; apertura: ${f.apertureFlagged}.`,
            ...(f.cutoutUrl
              ? [`IMAGE analizado: ${new URL(f.cutoutUrl, options.origin).href}`]
              : []),
            ...(f.archiveUrl ? [`FITS de archivo: ${f.archiveUrl}`] : []),
          ])
        : ['No hay exposiciones medidas. Esta consulta no permite interpretar píxeles.'],
    },
    {
      title: '6. Catálogos y procedencia',
      paragraphs: report.catalog
        ? [
            `${report.dataset ? 'Lectura de tablas guardadas' : 'Consulta'}: ${report.catalog.queriedAt}. Gaia DR3: ${report.catalog.byProvider.gaia} entradas; SIMBAD: ${report.catalog.byProvider.simbad}. Total de filas: ${report.catalog.entries}; pueden representar el mismo objeto.`,
            `Respuesta truncada: ${report.catalog.truncated ? 'sí' : 'no'}. Errores: ${report.catalog.errors.length}. Asociada con este análisis de píxeles: ${report.catalog.associatedWithPixels ? 'sí' : 'no'}.`,
            ...report.catalog.errors.map((e) => `Error de catálogo: ${e}`),
            'Las filas y probabilidades consultadas se conservan en el JSON adjunto. Una respuesta sin error no garantiza un inventario completo del cielo.',
            'Gaia DSC aporta probabilidades publicadas por Gaia, calculadas con sus modelos. No expresan la confianza de la asociación con SPHEREx ni una precisión validada de Eon. SIMBAD aporta información compilada de catálogo.',
          ]
        : ['No se dispone de una consulta de catálogos compatible con esta región y análisis.'],
    },
    {
      title: '7. Instrucciones de reproducción',
      paragraphs: [
        '1) Conserva este informe, el JSON completo y los IMAGE analizados. Los enlaces dependen de la disponibilidad de los archivos; no garantizan que los datos remotos permanezcan idénticos.',
        `2) Abre la vista indicada. ${report.dataset ? 'Activa explícitamente Abrir ejemplo real NGC 1491; usa sus tres exposiciones guardadas.' : 'En Animación busca las exposiciones de la región. Comprueba los IDs, fechas, detectores y archivos de la sección 5: buscar solo el mismo año no garantiza seleccionar las mismas imágenes.'}`,
        '3) Pulsa Animar región y espera la preparación. En Análisis usa el mismo umbral SEP indicado en la sección 4 y pulsa Interpretar región. Comprueba exposiciones fallidas, omitidas y límites antes de comparar resultados.',
        '4) Compara IDs de exposición, recortes, parámetros, entradas de catálogo y resultados por detección del JSON. Las respuestas de catálogo pueden cambiar; para una comparación histórica usa las filas guardadas y la misma versión del método.',
        '5) Inspecciona los FITS originales y las candidaturas ambiguas. Para medir movimiento, espectro o variabilidad hacen falta análisis instrumentales adicionales. Este informe permite revisar la evidencia; no sustituye esa validación científica.',
        'Código y método: https://github.com/Chompin003/eon | Documentación: https://github.com/Chompin003/eon/blob/main/docs/INTERPRETACION-REGION.md',
        'SEP: https://sep.readthedocs.io/en/stable/ | Espectrofotometría de referencia IRSA: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html',
      ],
    },
    ...snapshot.groupReports.map((g) => ({
      title: `Grupo ${g.id}${options.selected === g.id ? ' · seleccionado al exportar' : ''}`,
      paragraphs: [
        `${g.measurements} mediciones, ${g.distinctDates} fechas distintas. ${g.interpretation}`,
        `Siguiente revisión: ${g.nextStep}`,
        ...(g.separationArcsec === undefined
          ? []
          : [
              `Separación entre primer y último centroide: ${g.separationArcsec} segundos de arco. No mide movimiento propio.`,
            ]),
        ...g.evidence.map(
          (e) =>
            `${e.frameId} / ${e.detectionId} | ${e.dateUtc} | ${position(e.longitude, e.latitude)} | media en apertura: ${number(e.apertureMean)} ${e.unit}; error de extracción: ${number(e.apertureError)} (sin incertidumbre instrumental completa); SEP=${e.sepFlags}; apertura=${e.apertureFlags}. Candidaturas: ${e.candidates.length ? e.candidates.map((v) => `${v.name} [${v.provider}; ID ${v.id}; distancia ${v.distanceArcsec}″${v.probability === undefined ? '' : `; probabilidad de catálogo ${v.probability}`} ]`).join('; ') : 'ninguna'}.`,
        ),
      ],
    })),
  ];
  const title =
    report.mode === 'pixels'
      ? 'eon · Informe de interpretación de región'
      : 'eon · Consulta de catálogos';
  const text =
    [title, ...sections.flatMap((s) => ['\n' + s.title, ...s.paragraphs])].join('\n\n') + '\n';
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
    );
  // Standalone, offline, no scripts or remote fonts/images. Escape every data value.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;color:#232724;font:15px/1.65 system-ui,sans-serif}h1{font-size:26px}h2{font-size:19px;margin-top:32px;border-top:1px solid #d7ddda;padding-top:16px}p{overflow-wrap:anywhere;margin:10px 0}aside{padding:12px 16px;background:#edf4f1;border-left:3px solid #386d5c}@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0;font:10pt/1.5 sans-serif;max-width:none}h1{font-size:19pt}h2{font-size:13pt;break-after:avoid}p{orphans:3;widows:3}.screen{display:none}}</style></head><body><h1>${escape(title)}</h1><aside class="screen">Informe autónomo para compartir. Para guardarlo como PDF: menú del navegador → Imprimir → Guardar como PDF. Comparte también el informe JSON para conservar las tablas completas.</aside>${sections.map((s) => `<section><h2>${escape(s.title)}</h2>${s.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}</section>`).join('')}</body></html>`;
  return { text, html, snapshot };
}
