import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  TIMELINE_LIMITS,
  type FITSSource,
  type Observation,
  type ViewState,
  type BufferStatus,
  type ImageReadiness,
  type SkyRegion,
  type SharedExposure,
} from '../shared';
import { loadAllObservations } from './observations';

interface Props {
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onSourceChange: (source: FITSSource | null) => void;
  /** Whether the selected image has been presented by the viewer. */
  imageReadiness: ImageReadiness;
  bufferStatus: BufferStatus;
  selectedRegion?: SkyRegion;
  onSelectRegion: () => void;
  onClearRegion: () => void;
  restoreExposure?: SharedExposure;
  onRestoreSettled?: () => void;
}
const EMPTY_IDS: readonly string[] = [];
const EMPTY_BUFFER: BufferStatus = {
  total: 0,
  prepared: 0,
  ready: 0,
  failed: 0,
  bytes: 0,
  readyFrameIds: EMPTY_IDS,
  failedFrameIds: EMPTY_IDS,
  complete: false,
};

export function ObservationsPanel({
  view,
  onViewChange,
  onSourceChange,
  imageReadiness,
  bufferStatus: incomingBufferStatus,
  selectedRegion,
  onSelectRegion,
  onClearRegion,
  restoreExposure,
  onRestoreSettled,
}: Props) {
  const imageReady = useSyncExternalStore(imageReadiness.subscribe, imageReadiness.getSnapshot);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [center, setCenter] = useState<ViewState>();
  const [detector, setDetector] = useState('SPHEREx-D4');
  const [year, setYear] = useState('');
  const [index, setIndex] = useState(0);
  const [interval, setIntervalMs] = useState(200);
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [queryProgress, setQueryProgress] = useState('');
  const [regionSize, setRegionSize] = useState(0.1);
  const [queryRegion, setQueryRegion] = useState<SkyRegion>();
  const abort = useRef<AbortController | null>(null);
  const presented = useRef(imageReady);
  useEffect(() => {
    presented.current = imageReady;
  }, [imageReady]);
  const props = useRef({ view, onViewChange, onSourceChange });
  useEffect(() => {
    props.current = { view, onViewChange, onSourceChange };
  });
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (selectedRegion) {
      abort.current?.abort();
      setLoading(false);
      setEnabled(false);
      setPlaying(false);
      setObservations([]);
      setCenter(undefined);
      setRegionSize(selectedRegion.sizeDeg);
    }
  }, [selectedRegion]);
  const matching = useMemo(
    () => observations.filter((observation) => observation.detector === detector),
    [observations, detector],
  );
  useEffect(() => {
    if (!restoreExposure) return;
    const controller = new AbortController();
    abort.current = controller;
    const region = restoreExposure.region;
    const target = { ...region, fov: region.sizeDeg };
    setLoading(true);
    setError('');
    void loadAllObservations(target, '', controller.signal, setQueryProgress, region.sizeDeg)
      .then((result) => {
        if (controller.signal.aborted) return;
        const found = result.observations.find((o) => o.id === restoreExposure.id);
        if (!found)
          throw new Error(
            'La exposición del enlace no está disponible en IRSA. Puedes consultar otra fecha.',
          );
        setObservations(result.observations);
        setDetector(found.detector);
        setIndex(
          result.observations
            .filter((o) => o.detector === found.detector)
            .findIndex((o) => o.id === found.id),
        );
        setCenter(target);
        setQueryRegion(region);
        setRegionSize(region.sizeDeg);
        setTruncated(result.truncated);
        setEnabled(true);
        setPlaying(false);
      })
      .catch((problem) => {
        if (!controller.signal.aborted)
          setError(
            problem instanceof Error ? problem.message : 'No se pudo restaurar la exposición.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          onRestoreSettled?.();
        }
      });
    return () => controller.abort();
  }, [restoreExposure]);
  const active = matching[Math.min(index, Math.max(0, matching.length - 1))];
  const frames = useMemo(
    () =>
      center
        ? matching.map((active) => ({
            kind: 'fits' as const,
            id: active.id,
            title: `${active.detector} · ${active.dateUtc}`,
            dateUtc: active.dateUtc,
            center: { longitude: center.longitude, latitude: center.latitude },
            url: `/api/cutout?${new URLSearchParams({ url: active.url, ra: String(center.longitude), dec: String(center.latitude), size: ((queryRegion?.sizeDeg ?? 0.1) * 1.5).toFixed(6) })}`,
          }))
        : [],
    [matching, center, queryRegion],
  );
  const sequenceId = useMemo(() => crypto.randomUUID(), [frames]);
  const bufferStatus =
    incomingBufferStatus.sequenceId === sequenceId ? incomingBufferStatus : EMPTY_BUFFER;
  const fullyBuffered =
    bufferStatus.sequenceId === sequenceId &&
    bufferStatus.total === matching.length &&
    bufferStatus.complete &&
    bufferStatus.ready + bufferStatus.failed === matching.length &&
    matching.length > 0 &&
    bufferStatus.ready > 0;

  useEffect(() => {
    if (!enabled || !active || !center) {
      props.current.onSourceChange(null);
      return;
    }
    props.current.onSourceChange({
      ...frames.find((frame) => frame.id === active.id)!,
      sequence: { id: sequenceId, frames, attempt, region: queryRegion },
    });
  }, [enabled, active, center, frames, sequenceId, attempt, queryRegion]);

  const readyIds = bufferStatus.readyFrameIds ?? EMPTY_IDS;
  const readyIndexes = useMemo(() => {
    const ids = new Set(readyIds);
    return matching.flatMap((frame, index) => (ids.has(frame.id) ? [index] : []));
  }, [matching, readyIds]);
  const playback = useRef(readyIndexes);
  playback.current = readyIndexes;
  useEffect(() => {
    if (enabled && playing && readyIds.length && active && !readyIds.includes(active.id)) {
      const next = matching.findIndex((frame) => readyIds.includes(frame.id));
      if (next >= 0) setIndex(next);
    }
  }, [enabled, playing, readyIds, active, matching]);
  useEffect(() => {
    if (
      enabled &&
      bufferStatus.sequenceId === sequenceId &&
      bufferStatus.complete &&
      readyIds.length < 2
    )
      setPlaying(false);
  }, [enabled, bufferStatus.sequenceId, sequenceId, bufferStatus.complete, readyIds.length]);

  useEffect(() => {
    if (!playing || !enabled || matching.length < 2) return;
    const timer = window.setInterval(() => {
      // Under heavy rendering load, wait for this frame's acknowledgement
      // instead of silently skipping dates. The prepared sequence needs no I/O.
      if (!presented.current) return;
      const available = playback.current;
      if (available.length < 2) return;
      presented.current = false;
      setIndex((value) => available.find((index) => index > value) ?? available[0]);
    }, interval);
    return () => clearInterval(timer);
  }, [playing, enabled, matching.length, interval]);

  async function search() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError('');
    setPlaying(false);
    setEnabled(false);
    const region = selectedRegion ?? {
      longitude: view.longitude,
      latitude: view.latitude,
      sizeDeg: regionSize,
    };
    const target = { longitude: region.longitude, latitude: region.latitude, fov: region.sizeDeg };
    try {
      const result = await loadAllObservations(
        target,
        year,
        controller.signal,
        setQueryProgress,
        region.sizeDeg,
      );
      setObservations(result.observations);
      setTruncated(result.truncated);
      setCenter(target);
      setQueryRegion(region);
      setIndex(0);
      if (!result.observations.length)
        setError('No hay exposiciones publicadas que cubran estas coordenadas y este año.');
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(problem instanceof Error ? problem.message : 'No se pudo consultar IRSA.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function activate() {
    if (!center || !active) return;
    props.current.onViewChange({ ...center, fov: queryRegion?.sizeDeg ?? 0.1 });
    setEnabled(true);
    setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  return (
    <div className="observation-tools">
      <div className="time-actions">
        <button
          className="plain-button"
          onClick={() => {
            setEnabled(false);
            setPlaying(false);
            onSelectRegion();
          }}
        >
          Seleccionar región
        </button>
        {selectedRegion && (
          <button className="plain-button" onClick={onClearRegion}>
            Usar centro actual
          </button>
        )}
      </div>
      <label htmlFor="region-size">Lado de la región · {(regionSize * 60).toFixed(1)}′</label>
      <input
        id="region-size"
        aria-label="Tamaño de región"
        type="range"
        min="0.02"
        max="0.25"
        step="0.001"
        value={regionSize}
        onChange={(event) => {
          onClearRegion();
          setRegionSize(Number(event.target.value));
          setPlaying(false);
          setEnabled(false);
        }}
      />
      {selectedRegion && (
        <p className="survey-details">
          Región seleccionada: RA {selectedRegion.longitude.toFixed(6)}° · Dec{' '}
          {selectedRegion.latitude.toFixed(6)}°.
        </p>
      )}
      <label htmlFor="observation-year">Año de búsqueda</label>
      <select
        id="observation-year"
        className="survey-select"
        value={year}
        onChange={(event) => {
          setYear(event.target.value);
          setPlaying(false);
        }}
      >
        <option value="">Todos los años publicados</option>
        {Array.from(
          { length: Math.max(1, new Date().getUTCFullYear() - 2024) },
          (_, index) => 2025 + index,
        ).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button className="plain-button" disabled={loading} onClick={() => void search()}>
        {loading ? queryProgress || 'Consultando IRSA…' : 'Buscar exposiciones aquí'}
      </button>
      {center && (
        <p className="survey-details">
          Zona consultada: RA {center.longitude.toFixed(6)}° · Dec {center.latitude.toFixed(6)}°.
          Región: {((queryRegion?.sizeDeg ?? 0.1) * 60).toFixed(1)}′ ×{' '}
          {((queryRegion?.sizeDeg ?? 0.1) * 60).toFixed(1)}′.
        </p>
      )}
      <label htmlFor="observation-detector">Detector de las exposiciones</label>
      <select
        id="observation-detector"
        className="survey-select"
        value={detector}
        onChange={(event) => {
          setDetector(event.target.value);
          setIndex(0);
          setPlaying(false);
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((number) => (
          <option key={number} value={`SPHEREx-D${number}`}>
            D{number} ·{' '}
            {observations.filter((entry) => entry.detector === `SPHEREx-D${number}`).length}{' '}
            exposiciones
          </option>
        ))}
      </select>
      {active && (
        <>
          <div className="observation-date">
            <strong data-testid="observation-year">{active.dateUtc.slice(0, 4)}</strong>
            <time data-testid="epoch-date" dateTime={active.dateUtc}>
              {active.dateUtc.slice(0, 10)} · {active.dateUtc.slice(11, 19)} UTC
            </time>
          </div>
          <p className="survey-details">
            {enabled
              ? imageReady
                ? 'Imagen visible'
                : readyIds.includes(active.id)
                  ? 'Cuadro preparado'
                  : 'Cargando esta exposición…'
              : 'Exposición seleccionada'}{' '}
            · {active.collection} · {index + 1}/{matching.length}
          </p>
          <input
            type="range"
            aria-label="Fecha"
            min="0"
            max={Math.max(0, matching.length - 1)}
            step="1"
            value={index}
            disabled={matching.length < 2}
            onChange={(event) => {
              setIndex(Number(event.target.value));
              setPlaying(false);
            }}
          />
          <div className="time-endpoints">
            <span>{matching[0]?.dateUtc.slice(0, 10)}</span>
            <span>{matching.at(-1)?.dateUtc.slice(0, 10)}</span>
          </div>
          <button className="plain-button" onClick={activate}>
            Animar región
          </button>
          {enabled && (
            <div
              className="buffer-status"
              role="status"
              data-testid="buffer-progress"
              data-ready={fullyBuffered}
              data-prepared={bufferStatus.prepared}
              data-failed={bufferStatus.failed}
              data-total={matching.length}
              data-complete={bufferStatus.complete ?? false}
              data-cache-hits={bufferStatus.cacheHits ?? 0}
            >
              <span>
                {fullyBuffered
                  ? `${bufferStatus.ready} cuadros listos · reproducción desde memoria`
                  : `${bufferStatus.ready} / ${matching.length} cuadros disponibles${bufferStatus.complete ? '' : ' · preparando el resto…'}`}
              </span>
              <progress
                max={matching.length}
                value={Math.min(matching.length, bufferStatus.ready + bufferStatus.failed)}
                aria-label="Preparación de animación"
              />
              {bufferStatus.failed > 0 && (
                <>
                  <span>
                    {bufferStatus.failed}{' '}
                    {bufferStatus.failed === 1 ? 'fecha no disponible' : 'fechas no disponibles'}.
                    Se pueden reproducir los cuadros cargados. {bufferStatus.errorMessage}
                  </span>
                  {(!bufferStatus.unavailableFrames ||
                    bufferStatus.unavailableFrames.some((frame) => frame.retryable)) && (
                    <button
                      className="plain-button"
                      onClick={() => {
                        setAttempt((value) => value + 1);
                      }}
                    >
                      Reintentar cuadros
                    </button>
                  )}
                  <MissingDates
                    observations={matching}
                    ids={bufferStatus.failedFrameIds}
                    failures={bufferStatus.unavailableFrames}
                  />
                </>
              )}
            </div>
          )}
          <p className="survey-details">
            <a href={active.url} target="_blank" rel="noreferrer">
              FITS original completo · IRSA
            </a>
            . La vista aplica corrección SIP e interpolación; usa el archivo original para análisis.
          </p>
          <p className="survey-details">
            La longitud de onda varía entre exposiciones de un detector. El parpadeo permite
            explorar imágenes; no constituye una medición de variabilidad a longitud de onda fija.
          </p>
        </>
      )}
      {center && !active && (
        <p className="survey-details">
          No hay imágenes de D{detector.at(-1)} en esta consulta. Elige otro detector o año.
        </p>
      )}
      <div className="interval-row">
        <label htmlFor="blink-interval">Intervalo entre imágenes</label>
        <output data-testid="interval">{interval} ms</output>
      </div>
      <input
        id="blink-interval"
        type="range"
        aria-label="Intervalo entre fechas"
        min={TIMELINE_LIMITS.minIntervalMs}
        max={TIMELINE_LIMITS.maxIntervalMs}
        step="50"
        value={interval}
        onChange={(event) => setIntervalMs(Number(event.target.value))}
      />
      <div className="time-actions">
        <button
          className="plain-button"
          disabled={!enabled || (!playing && readyIds.length < 2)}
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? 'Pausar' : 'Reproducir'}
        </button>
        <button
          className="plain-button"
          disabled={!enabled}
          onClick={() => {
            setPlaying(false);
            setEnabled(false);
            if (center) props.current.onViewChange(center);
          }}
        >
          Volver al mosaico
        </button>
      </div>
      <p className="survey-details">
        SPHEREx empezó en 2025. Se muestran únicamente fechas disponibles en IRSA. El mosaico
        combinado no representa un año individual. La animación empieza con las fechas disponibles y
        continúa mientras se preparan las demás. Las fechas fallidas aparecen en la lista; las zonas
        sin cobertura permanecen vacías.
      </p>
      {truncated && (
        <p className="survey-details">
          IRSA limitó la respuesta a 2000 resultados. Filtra por año y repite la búsqueda para
          completar la selección.
        </p>
      )}
      {error && (
        <p role="alert" className="coordinate-error">
          {error}
        </p>
      )}
    </div>
  );
}

const MissingDates = memo(function MissingDates({
  observations,
  ids,
  failures,
}: {
  observations: readonly Observation[];
  ids?: readonly string[];
  failures?: BufferStatus['unavailableFrames'];
}) {
  return (
    <details>
      <summary>Ver fechas no disponibles</summary>
      <ul className="missing-dates">
        {observations
          .filter((frame) => ids?.includes(frame.id))
          .map((frame) => (
            <li key={frame.id}>
              {frame.dateUtc.slice(0, 19).replace('T', ' ')} UTC ·{' '}
              {failures?.find((error) => error.id === frame.id)?.reason}
            </li>
          ))}
      </ul>
    </details>
  );
});
