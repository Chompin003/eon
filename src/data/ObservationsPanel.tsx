import { useEffect, useMemo, useRef, useState } from 'react';
import { TIMELINE_LIMITS, type FITSSource, type Observation, type ViewState } from '../shared';
import { parseObservations } from './observations';

interface Props {
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onSourceChange: (source: FITSSource | null) => void;
  /** Playback advances only after the current FITS has actually loaded. */
  imageReady: boolean;
}

export function ObservationsPanel({ view, onViewChange, onSourceChange, imageReady }: Props) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [center, setCenter] = useState<ViewState>();
  const [detector, setDetector] = useState('SPHEREx-D4');
  const [year, setYear] = useState('');
  const [index, setIndex] = useState(0);
  const [interval, setIntervalMs] = useState(500);
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const props = useRef({ view, onViewChange, onSourceChange });
  useEffect(() => {
    props.current = { view, onViewChange, onSourceChange };
  });
  useEffect(() => () => abort.current?.abort(), []);
  const matching = useMemo(
    () => observations.filter((observation) => observation.detector === detector),
    [observations, detector],
  );
  const active = matching[Math.min(index, Math.max(0, matching.length - 1))];

  useEffect(() => {
    if (!enabled || !active || !center) {
      props.current.onSourceChange(null);
      return;
    }
    const params = new URLSearchParams({
      url: active.url,
      ra: String(center.longitude),
      dec: String(center.latitude),
      size: '0.1',
    });
    props.current.onSourceChange({
      kind: 'fits',
      id: active.id,
      title: `${active.detector} · ${active.dateUtc}`,
      dateUtc: active.dateUtc,
      center: { longitude: center.longitude, latitude: center.latitude },
      url: `/api/cutout?${params}`,
    });
  }, [enabled, active, center]);

  useEffect(() => {
    if (!playing || !enabled || matching.length < 2 || !imageReady) return;
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % matching.length),
      interval,
    );
    return () => clearTimeout(timer);
  }, [playing, enabled, matching.length, interval, imageReady, index]);

  async function search() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError('');
    setPlaying(false);
    setEnabled(false);
    const target = { ...view };
    try {
      const params = new URLSearchParams({
        ra: String(target.longitude),
        dec: String(target.latitude),
      });
      if (year) params.set('year', year);
      const response = await fetch(`/api/observations?${params}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(50000)]),
      });
      if (!response.ok) throw new Error('IRSA no respondió a la búsqueda. Reintenta.');
      const result = parseObservations(await response.text());
      setObservations(result.observations);
      setTruncated(result.truncated);
      setCenter(target);
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
    props.current.onViewChange({ ...center, fov: 0.08 });
    setEnabled(true);
  }

  return (
    <div className="observation-tools">
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
        {loading ? 'Consultando IRSA…' : 'Buscar exposiciones aquí'}
      </button>
      {center && (
        <p className="survey-details">
          Zona consultada: RA {center.longitude.toFixed(6)}° · Dec {center.latitude.toFixed(6)}°.
          Recorte: 0.1°.
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
            Ver exposición / centrar recorte
          </button>
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
        <label htmlFor="blink-interval">Intervalo mínimo entre imágenes</label>
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
          disabled={!enabled || matching.length < 2}
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
        combinado no representa un año individual. Las imágenes se cargan antes de avanzar.
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
