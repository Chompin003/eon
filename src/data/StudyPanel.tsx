import { useEffect, useRef, useState } from 'react';
import {
  OBJECT_STYLES,
  objectPosition,
  observationYear,
  type RegionStudy,
  type SkyRegion,
  type StudyObject,
  type ViewState,
} from '../shared';
import { studyRegion } from './study';
interface Props {
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
  useEffect(() => () => abort.current?.abort(), []);
  async function run() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError('');
    props.onSelected(undefined);
    const region = props.region ?? {
      longitude: props.view.longitude,
      latitude: props.view.latitude,
      sizeDeg: Math.max(0.02, Math.min(0.25, props.view.fov)),
    };
    try {
      const result = await studyRegion(region, controller.signal);
      if (!controller.signal.aborted) {
        props.onResult(result);
        props.onVisibleChange(true);
      }
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(problem instanceof Error ? problem.message : 'No se pudo estudiar la región.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const result = props.result,
    selected = props.selected;
  return (
    <section className="control-section" aria-labelledby="study-heading">
      <div className="section-title">
        <h2 id="study-heading">Estudiar región</h2>
        <span>Gaia · SIMBAD</span>
      </div>
      <button className="plain-button" disabled={loading} onClick={() => void run()}>
        {loading ? 'Consultando catálogos…' : 'Interpretar región'}
      </button>
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
        Usa la región seleccionada o un cuadrado de hasta 15′ en el centro actual. Gaia aporta
        clases de un modelo ya entrenado; SIMBAD aporta tipos catalogados.
      </p>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p className="survey-details" data-testid="study-count">
            {result.objects.length} entradas catalogadas · {(result.region.sizeDeg * 60).toFixed(1)}
            ′ de lado. Los dos catálogos pueden incluir el mismo objeto.
          </p>
          {result.errors.map((message) => (
            <p className="survey-details" role="alert" key={message}>
              {message}
            </p>
          ))}
          {result.truncated && (
            <p role="alert">
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
