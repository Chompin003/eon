import { useId, useMemo, useState } from 'react';
import {
  OBJECT_STYLES,
  exportFilename,
  formatAngularSize,
  type FITSSource,
  type PixelStudy,
  type RegionStudy,
  type SkyRegion,
} from '../../shared';
import { formatSexagesimal } from '../coordinates/convert';
import { buildInterpretation, countText, exportInterpretation, interpretGroup } from './engine';
import './report.css';

interface Props {
  onPrepareImages?: () => void;
  region: SkyRegion;
  source?: FITSSource;
  pixels?: PixelStudy;
  catalog?: RegionStudy;
  selected?: string;
  onSelect: (id: string) => void;
  onFrame: (id: string) => void;
}
const dateLabel = (value: string) => value.slice(0, 19).replace('T', ' ') + ' UTC';
const ruleLabels: Record<string, string> = {
  'pixel-detections': 'Detección en los píxeles',
  'positional-recurrence': 'Enlace entre fechas',
  counterparts: 'Contrapartes de catálogo',
  'catalog-entries': 'Entradas de catálogo',
};

export function RegionReport({
  onPrepareImages,
  region,
  source,
  pixels,
  catalog,
  selected,
  onSelect,
  onFrame,
}: Props) {
  const heading = useId();
  const [exportError, setExportError] = useState('');
  const frames = source?.sequence?.frames,
    dataset = source?.dataset;
  // Changing the displayed epoch does not rebuild a report or perform any I/O.
  const report = useMemo(
    () =>
      buildInterpretation({
        region: {
          longitude: region.longitude,
          latitude: region.latitude,
          sizeDeg: region.sizeDeg,
          extended: region.extended,
        },
        frames,
        dataset,
        pixels,
        catalog,
      }),
    [
      region.longitude,
      region.latitude,
      region.sizeDeg,
      region.extended,
      frames,
      dataset,
      pixels,
      catalog,
    ],
  );
  const group = useMemo(
    () => (selected ? interpretGroup(report, selected) : undefined),
    [report, selected],
  );
  const groupEvidence = group ? report.groups.find((g) => g.id === group.id) : undefined;
  const attention = report.cautions.filter(
    (f) =>
      !['instrument-quality', 'spectral-comparability', 'motion-not-measured'].includes(f.rule),
  );
  const download = () => {
    setExportError('');
    try {
      const data = {
        createdAtUtc: new Date().toISOString(),
        ...exportInterpretation(report, selected),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFilename(region).replace(/\.png$/, '_informe.json');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('No se pudo descargar el informe. Inténtalo otra vez.');
    }
  };
  return (
    <section
      className="interpretation-report"
      aria-labelledby={heading}
      data-testid="interpretation-report"
      data-method={report.method}
    >
      <div className="section-title">
        <h3 id={heading}>
          {report.mode === 'pixels' ? 'Informe de región' : 'Consulta de catálogos'}
        </h3>
        <span>Reglas · SEP y catálogos</span>
      </div>
      <p className="report-scope">
        {report.dataset ? 'Ejemplo real guardado · ' : ''}
        {formatAngularSize(report.region.sizeDeg)} de lado
        <br />
        RA {formatSexagesimal(report.region.longitude, 'ra')} · Dec{' '}
        {formatSexagesimal(report.region.latitude, 'dec')} · ICRS/J2000
      </p>
      <p className="report-summary" data-testid="interpretation-summary">
        {report.summary}
      </p>
      {report.mode === 'unavailable' && (
        <p>
          Selecciona la región y pulsa Interpretar región para generar un informe con los datos
          actuales.
        </p>
      )}
      {report.mode === 'pixels' && (
        <>
          <p>
            {report.exposures[0] && dateLabel(report.exposures[0].dateUtc)}
            <br />
            hasta {report.exposures.at(-1) && dateLabel(report.exposures.at(-1)!.dateUtc)}.
          </p>
          <p>
            Contrapartes por detección:{' '}
            {countText(report.counts.candidate, 'candidata', 'candidatas')},{' '}
            {countText(report.counts.ambiguous, 'ambigua', 'ambiguas')} y {report.counts.unmatched}{' '}
            sin coincidencia en las respuestas usadas.
          </p>
        </>
      )}
      {report.mode === 'pixels' ? (
        <div className="report-unassessed" data-testid="report-unassessed">
          <strong>Límites científicos</strong>
          <p>
            Calidad instrumental, movimiento físico y variabilidad de brillo sin evaluar. Este
            informe no confirma identidades ni descubrimientos.
          </p>
        </div>
      ) : (
        <div className="analysis-prerequisite">
          <strong>
            {source?.sequence?.region
              ? 'Falta completar el análisis de píxeles'
              : 'Imágenes pendientes de analizar'}
          </strong>
          <p>
            {source?.sequence?.region
              ? 'Revisa los errores del análisis y vuelve a pulsar Interpretar región.'
              : 'Solo se consultaron catálogos. Carga las exposiciones en Animación y vuelve a Interpretar región para medir los píxeles.'}
          </p>
          {!source?.sequence?.region && onPrepareImages && (
            <button className="plain-button" onClick={onPrepareImages}>
              Abrir Animación
            </button>
          )}
        </div>
      )}
      {attention.length > 0 && (
        <ul className="report-attention">
          {attention.map((finding) => (
            <li key={finding.rule} data-rule={finding.rule}>
              {finding.text}
            </li>
          ))}
        </ul>
      )}
      {report.groups.length > 0 && (
        <details className="report-details">
          <summary>Grupos con más fechas medidas</summary>
          <p>Ordenados por fechas distintas, no por probabilidad de descubrimiento.</p>
          <div className="report-group-list">
            {report.groups.slice(0, 6).map((g) => (
              <button
                className="plain-button"
                key={g.id}
                aria-pressed={selected === g.id}
                onClick={() => onSelect(g.id)}
              >
                {g.id} · {countText(g.measurements.length, 'exposición', 'exposiciones')} /{' '}
                {countText(g.distinctDates, 'fecha', 'fechas')}
              </button>
            ))}
          </div>
          {report.groups.length > 6 && (
            <p>Para revisar otros grupos, usa Explorar fuente detectada, debajo del informe.</p>
          )}
        </details>
      )}
      {group && (
        <div className="report-source" data-testid="source-interpretation">
          <h4>Grupo {group.id}</h4>
          <p>
            {countText(group.measurements, 'medición', 'mediciones')} en{' '}
            {countText(group.distinctDates, 'fecha distinta', 'fechas distintas')}. Un enlace por
            proximidad no prueba que sean el mismo objeto.
          </p>
          <p>{group.interpretation}</p>
          <p>
            <strong>Siguiente revisión:</strong> {group.nextStep}
          </p>
          {group.candidate && (
            <p>
              Clase de catálogo: {OBJECT_STYLES[group.candidate.category].label}.
              {group.candidate.provider === 'Gaia DR3' &&
                group.candidate.probability !== undefined && (
                  <>
                    {' '}
                    Probabilidad publicada por Gaia:{' '}
                    {(group.candidate.probability * 100).toFixed(2)}
                    %; no mide la probabilidad de esta asociación ni la precisión de Eon.
                  </>
                )}
            </p>
          )}
          {group.separationArcsec !== undefined && (
            <p>
              Separación entre primer y último centroide: {group.separationArcsec.toFixed(2)}″. Es
              una separación angular sin incertidumbre instrumental completa; no una medida de
              movimiento propio.
            </p>
          )}
          <p>
            {countText(
              group.sepFlagged,
              'medición con banderas SEP',
              'mediciones con banderas SEP',
            )}{' '}
            y{' '}
            {countText(
              group.apertureFlagged,
              'con banderas de apertura',
              'con banderas de apertura',
            )}
            . FLAGS instrumentales y saturación sin evaluar.
          </p>
          <details className="report-details">
            <summary>Evidencias del grupo {group.id}</summary>
            {groupEvidence?.measurements.map(({ frame, detection }) => (
              <div className="report-evidence" key={frame.frameId}>
                <time dateTime={frame.dateUtc}>{dateLabel(frame.dateUtc)}</time>
                <p>
                  RA {detection.longitude.toFixed(7)}° · Dec {detection.latitude.toFixed(7)}°.
                </p>
                <p>
                  Señal en apertura: {detection.apertureMean?.toPrecision(5) ?? 'sin medida'}{' '}
                  {frame.bunit}. No es flujo integrado corregido.
                </p>
                <p>
                  SEP {detection.flags} · apertura {detection.apertureFlags}.
                </p>
                {detection.candidates.length > 0 && (
                  <p>
                    Candidaturas:{' '}
                    {detection.candidates
                      .slice(0, 3)
                      .map((c) => `${c.name} (${c.provider})`)
                      .join('; ')}
                    {detection.candidates.length > 3
                      ? `; ${detection.candidates.length - 3} más en el JSON`
                      : ''}
                    .
                  </p>
                )}
                <button className="text-button" onClick={() => onFrame(frame.frameId)}>
                  Ver exposición {frame.dateUtc.slice(0, 10)}
                </button>
              </div>
            ))}
          </details>
        </div>
      )}
      <details className="report-details">
        <summary>Datos, evidencias y reglas</summary>
        <p>
          Informe calculado localmente mediante reglas explícitas. No usa un modelo entrenado por
          Eon ni genera afirmaciones con un modelo de lenguaje.
        </p>
        {report.catalog && (
          <p>
            {report.dataset ? 'Lectura de catálogos guardados' : 'Consulta de catálogos'}:{' '}
            {dateLabel(report.catalog.queriedAt)}. {report.catalog.byProvider.gaia} entradas Gaia
            DR3 y {report.catalog.byProvider.simbad} SIMBAD; pueden incluir el mismo objeto.
          </p>
        )}
        {report.catalog && (
          <p>
            Las entradas utilizadas se conservan en el JSON para revisar la procedencia de las
            candidaturas. Una consulta sin fallos no garantiza un inventario completo del cielo.
          </p>
        )}
        {Boolean(report.catalog?.errors.length) && (
          <p>
            {countText(
              report.catalog!.errors.length,
              'consulta de catálogo fallida',
              'consultas de catálogo fallidas',
            )}
            ; sus mensajes se muestran en el panel de análisis y se conservan en el JSON.
          </p>
        )}
        <p>
          {countText(report.counts.analyzed, 'exposición analizada', 'exposiciones analizadas')} de{' '}
          {report.counts.inSequence} en la secuencia;{' '}
          {countText(report.counts.failed, 'fallida', 'fallidas')} y {report.counts.omitted} fuera
          del límite del analizador.
        </p>
        <p>
          Los mosaicos HiPS, Hubble/Webb y las anotaciones son contexto visual; no se usan como
          mediciones fotométricas en este informe.
        </p>
        <p>
          La fracción de píxeles válidos se refiere al recorte FITS. No cuantifica la cobertura de
          toda la región ni evalúa calidad instrumental. Una falta de detección no demuestra
          ausencia del objeto.
        </p>
        {report.observations.map((finding) => (
          <p key={finding.rule} data-rule={finding.rule}>
            <strong>{ruleLabels[finding.rule] ?? finding.rule}:</strong> {finding.text}
          </p>
        ))}
        {report.exposures.map((frame) => (
          <div className="report-evidence" key={frame.id}>
            <time dateTime={frame.dateUtc}>{dateLabel(frame.dateUtc)}</time>
            <p>
              {countText(frame.detections, 'detección retenida', 'detecciones retenidas')}
              {frame.retainedOf !== undefined && frame.retainedOf > frame.detections
                ? ` (${frame.retainedOf} antes del límite)`
                : ''}{' '}
              · píxeles válidos del recorte:{' '}
              {frame.validPixelFraction !== undefined
                ? `${(frame.validPixelFraction * 100).toFixed(1)}%`
                : 'sin dato'}
              .
            </p>
            <button className="text-button" onClick={() => onFrame(frame.id)}>
              Ver exposición {frame.dateUtc.slice(0, 10)}
            </button>
            {frame.cutoutUrl && (
              <>
                {' '}
                ·{' '}
                <a href={frame.cutoutUrl} target="_blank" rel="noreferrer">
                  Recorte analizado
                </a>
              </>
            )}
            {frame.archiveUrl && (
              <>
                {' '}
                ·{' '}
                <a href={frame.archiveUrl} target="_blank" rel="noreferrer">
                  FITS de archivo · IRSA
                </a>
              </>
            )}
          </div>
        ))}
        {report.failures.map((f) => (
          <p key={f.frameId}>
            Exposición no analizable: {f.frameId}. El motivo completo está en los resultados de
            píxeles y en el JSON.
          </p>
        ))}
        {report.cautions
          .filter((f) => !attention.includes(f))
          .map((finding) => (
            <p key={finding.rule} data-rule={finding.rule}>
              {finding.text}
            </p>
          ))}
        <a
          href="https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html"
          target="_blank"
          rel="noreferrer"
        >
          Método científico de referencia · IRSA
        </a>
      </details>
      <button className="plain-button" disabled={report.mode === 'unavailable'} onClick={download}>
        Descargar informe JSON
      </button>
      {exportError && <p role="alert">{exportError}</p>}
    </section>
  );
}
