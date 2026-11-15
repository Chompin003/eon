import { useEffect, useRef, useState } from 'react';
import {
  OBJECT_STYLES,
  objectPosition,
  observationYear,
  type RegionStudy,
  type SkyRegion,
  type StudyObject,
  type ViewState,
  type FITSSource,
  type PixelStudy,
  type PixelStudyRequest,
  type PixelProgress,
} from '../shared';
import { studyRegion } from './study';
import { PixelResults } from './PixelResults';
import { RegionReport } from './interpretation/RegionReport';
interface Props {
  onPrepareImages?: (region: SkyRegion) => void;
  onOpenExample: () => void;
  imageSource?: FITSSource;
  analyzePixels: (
    request: PixelStudyRequest,
    signal: AbortSignal,
    onProgress: (progress: PixelProgress) => void,
  ) => Promise<PixelStudy>;
  pixelStudy?: PixelStudy;
  onPixelStudy: (study: PixelStudy) => void;
  selectedTrack?: string;
  onTrackSelected: (id: string) => void;
  showPixels: boolean;
  onShowPixels: (show: boolean) => void;
  onFrame: (id: string) => void;
  date?: string;
  region?: SkyRegion;
  view: ViewState;
  result?: RegionStudy;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onResult: (result: RegionStudy | undefined) => void;
  selected?: StudyObject;
  onSelected: (object: StudyObject | undefined) => void;
  onViewChange: (view: ViewState) => void;
}
export function StudyPanel(props: Props) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const abort = useRef<AbortController | undefined>(undefined);
  const [threshold, setThreshold] = useState(5),
    [progress, setProgress] = useState<PixelProgress>();
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    abort.current?.abort();
    setLoading(false);
    setProgress(undefined);
  }, [props.imageSource?.sequence?.id]);
  const analysisRegion = props.imageSource?.sequence?.region ??
    props.region ?? {
      longitude: props.view.longitude,
      latitude: props.view.latitude,
      sizeDeg: Math.max(0.02, Math.min(0.25, props.view.fov)),
    };
  async function run() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError('');
    props.onSelected(undefined);
    const region = analysisRegion;
    try {
      const result = await studyRegion(region, controller.signal, props.imageSource?.dataset);
      if (!controller.signal.aborted) {
        props.onResult(result);
        props.onVisibleChange(true);
        const image = props.imageSource;
        if (image?.sequence?.region) {
          const measured = await props.analyzePixels(
            {
              frames: image.sequence.frames,
              dataset: image.dataset,
              catalogQueriedAt: result.queriedAt,
              activeFrameId: image.id,
              region: image.sequence.region,
              catalog: result.objects,
              threshold,
            },
            controller.signal,
            setProgress,
          );
          if (!controller.signal.aborted) {
            props.onPixelStudy(measured);
            props.onShowPixels(true);
            props.onVisibleChange(false);
          }
        }
      }
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(problem instanceof Error ? problem.message : 'No se pudo estudiar la región.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const result = props.result,
    selected = props.selected,
    hasImages = Boolean(props.imageSource?.sequence?.region);
  return (
    <section className="control-section" aria-labelledby="study-heading">
      <div className="section-title">
        <h2 id="study-heading">Estudiar región</h2>
        <span>Gaia · SIMBAD</span>
      </div>
      {hasImages ? (
        <button className="plain-button" disabled={loading} onClick={() => void run()}>
          {loading ? (progress?.message ?? 'Consultando catálogos…') : 'Interpretar región'}
        </button>
      ) : (
        <div className="analysis-prerequisite" data-testid="analysis-prerequisite">
          <strong>Primero carga las imágenes de la región</strong>
          <p>
            En Animación: busca exposiciones y pulsa Animar región. Después vuelve a Análisis para
            interpretar los píxeles.
          </p>
          <button
            className="plain-button"
            disabled={loading || !props.onPrepareImages}
            onClick={() => props.onPrepareImages?.(analysisRegion)}
          >
            Preparar imágenes para analizar
          </button>
          <button className="text-button" disabled={loading} onClick={() => void run()}>
            {loading ? 'Consultando catálogos…' : 'Consultar solo catálogos'}
          </button>
        </div>
      )}
      {loading && (
        <button
          className="text-button"
          onClick={() => {
            abort.current?.abort();
            setLoading(false);
          }}
        >
          Cancelar consulta
        </button>
      )}
      <p className="survey-details">
        {props.imageSource?.sequence?.region
          ? 'Detecta fuentes en los FITS originales, cruza los catálogos y mide cada exposición sin bloquear el visor.'
          : 'Consulta catálogos en la región. Para analizar píxeles y fechas, activa primero las exposiciones de esa región.'}
      </p>
      <button className="text-button" disabled={loading} onClick={props.onOpenExample}>
        Abrir ejemplo real · NGC 1491
      </button>
      {props.imageSource?.sequence?.region && (
        <>
          <label htmlFor="pixel-threshold">Umbral de detección · {threshold}σ</label>
          <input
            id="pixel-threshold"
            aria-label="Umbral de detección"
            type="range"
            min="3"
            max="10"
            step=".5"
            value={threshold}
            disabled={loading}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </>
      )}
      {loading && progress && (
        <progress
          aria-label="Avance del análisis"
          value={progress.completed}
          max={progress.total}
        />
      )}
      {error && (
        <p role="alert" className="scientific-notice scientific-notice-error">
          {error}
        </p>
      )}
      {!loading && (result || props.pixelStudy) && (
        <RegionReport
          region={analysisRegion}
          source={props.imageSource}
          pixels={props.pixelStudy}
          catalog={result}
          selected={props.selectedTrack}
          onSelect={props.onTrackSelected}
          onFrame={props.onFrame}
          onPrepareImages={props.onPrepareImages}
        />
      )}
      {props.pixelStudy && (
        <PixelResults
          result={props.pixelStudy}
          source={props.imageSource}
          selected={props.selectedTrack}
          onSelected={props.onTrackSelected}
          visible={props.showPixels}
          onVisible={props.onShowPixels}
          onFrame={props.onFrame}
        />
      )}
      {result && (
        <>
          <p className="survey-details" data-testid="study-count">
            {result.objects.length} entradas catalogadas · {(result.region.sizeDeg * 60).toFixed(1)}
            ′ de lado. Los dos catálogos pueden incluir el mismo objeto.
          </p>
          {result.errors.map((message) => (
            <p className="scientific-notice scientific-notice-error" role="alert" key={message}>
              {message}
            </p>
          ))}
          {result.truncated && (
            <p role="alert" className="scientific-notice">
              Se alcanzó el límite de catálogo: estos resultados son parciales. Elige una región
              menor.
            </p>
          )}
          <label className="study-toggle">
            <input
              type="checkbox"
              checked={props.visible}
              onChange={(e) => props.onVisibleChange(e.target.checked)}
            />{' '}
            Mostrar identificaciones
          </label>
          <div className="study-legend">
            {Object.entries(OBJECT_STYLES).map(([key, style]) => (
              <span key={key}>
                <i style={{ background: style.color }} />
                {style.label}
              </span>
            ))}
          </div>
          <label htmlFor="study-object">Explorar entradas</label>
          <select
            id="study-object"
            className="survey-select"
            value={selected?.id ?? ''}
            onChange={(e) => props.onSelected(result.objects.find((o) => o.id === e.target.value))}
          >
            <option value="">Elige una marca o una entrada</option>
            {result.objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {OBJECT_STYLES[o.category].label} · {o.provider}
              </option>
            ))}
          </select>
          {selected && (
            <div className="study-details">
              <strong>{selected.name}</strong>
              <p>
                {selected.provider === 'Gaia DR3'
                  ? 'Clase sugerida por Gaia DSC'
                  : 'Tipo catalogado en SIMBAD'}
                : {OBJECT_STYLES[selected.category].label}
              </p>
              {selected.probability !== undefined && (
                <p>
                  Probabilidad publicada: {(selected.probability * 100).toFixed(2)}%. No equivale a
                  precisión medida de eon.
                </p>
              )}
              <p>{selected.description}</p>
              <p>
                ICRS · RA {selected.longitude.toFixed(7)}° · Dec {selected.latitude.toFixed(7)}° ·
                época de referencia J{selected.referenceEpoch}.
              </p>
              <p>
                {selected.pmra !== undefined && selected.pmdec !== undefined
                  ? 'La marca aplica el movimiento propio del catálogo a la fecha mostrada; no sigue píxeles medidos.'
                  : 'Sin movimiento propio completo: posición de catálogo fija.'}
              </p>
              <button
                className="text-button"
                onClick={() => {
                  const at = objectPosition(selected, observationYear(props.date));
                  props.onViewChange({ ...props.view, longitude: at[0], latitude: at[1] });
                }}
              >
                Centrar esta entrada
              </button>
              {' · '}
              <a
                target="_blank"
                rel="noreferrer"
                href={
                  selected.provider === 'SIMBAD'
                    ? `https://simbad.harvard.edu/simbad/sim-id?Ident=${encodeURIComponent(selected.name)}`
                    : 'https://irsa.ipac.caltech.edu/Missions/gaia.html'
                }
              >
                Consultar fuente
              </a>
            </div>
          )}
          <p className="survey-details">
            Las marcas identifican posiciones de catálogo; no prueban que cada objeto sea resoluble
            en estos píxeles. No se clasifica todo el contenido de la imagen. Gaia usa datos
            ópticos, no los espectros SPHEREx. Clases Gaia bajo 80% quedan sin clasificar. Se
            muestran hasta 200 marcas; todas las entradas recibidas están en la lista.
          </p>
        </>
      )}
    </section>
  );
}
