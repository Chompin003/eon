import { useEffect, useRef, useState } from 'react';
import { searchHubble } from './hubbleArchive';
import { ARCHIVE_SURVEYS, type ArchiveHiPSSource, type ViewState } from '../shared';

interface Props {
  source?: ArchiveHiPSSource;
  onSourceChange: (source: ArchiveHiPSSource | undefined) => void;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  mode: 'split' | 'overlay';
  onModeChange: (mode: 'split' | 'overlay') => void;
  transparency: number;
  onTransparencyChange: (value: number) => void;
}

export function TelescopeComparison({
  source,
  onSourceChange,
  view,
  onViewChange,
  mode,
  onModeChange,
  transparency,
  onTransparencyChange,
}: Props) {
  const [results, setResults] = useState<ArchiveHiPSSource[]>([]);
  const [status, setStatus] = useState('');
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), [source?.provider]);
  useEffect(() => {
    request.current?.abort();
    setResults([]);
    setStatus('');
  }, [view.longitude, view.latitude]);
  async function search() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResults([]);
    setStatus('Consultando HLA…');
    try {
      const found = await searchHubble(view, controller.signal);
      if (controller.signal.aborted) return;
      setResults(found);
      setStatus(
        found.length
          ? 'Elige una observación para cargar el recorte.'
          : 'Sin observaciones HLA en esta región.',
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setStatus(error instanceof Error ? error.message : 'No se pudo consultar HLA.');
    }
  }
  return (
    <section className="control-section" aria-labelledby="telescope-heading">
      <div className="section-title">
        <h2 id="telescope-heading">Comparar telescopios</h2>
        <span>SPHEREx como referencia</span>
      </div>
      <div className="display-modes" role="group" aria-label="Telescopio de comparación">
        <button
          className="plain-button"
          aria-pressed={!source}
          onClick={() => onSourceChange(undefined)}
        >
          SPHEREx
        </button>
        {(['Hubble', 'Webb'] as const).map((telescope) => (
          <button
            className="plain-button"
            key={telescope}
            aria-pressed={source?.telescope === telescope}
            onClick={() =>
              onSourceChange(ARCHIVE_SURVEYS.find((item) => item.telescope === telescope)!)
            }
          >
            {telescope}
          </button>
        ))}
      </div>
      {source && (
        <>
          <div className="display-modes" role="group" aria-label="Distribución de telescopios">
            <button
              className="plain-button"
              aria-pressed={mode === 'overlay'}
              onClick={() => onModeChange('overlay')}
            >
              Superposición
            </button>
            <button
              className="plain-button"
              aria-pressed={mode === 'split'}
              onClick={() => onModeChange('split')}
            >
              Pantalla dividida
            </button>
          </div>
          {mode === 'overlay' && (
            <>
              <label htmlFor="telescope-transparency">
                Transparencia de {source.telescope} · {transparency}%
              </label>
              <input
                id="telescope-transparency"
                aria-label="Transparencia del telescopio"
                type="range"
                min="0"
                max="100"
                value={transparency}
                onChange={(e) => onTransparencyChange(Number(e.target.value))}
              />
              <p className="survey-details">
                0%: solo {source.telescope} donde hay cobertura. 100%: solo SPHEREx.
              </p>
            </>
          )}
          {source.provider === 'HLA' && (
            <>
              <button className="plain-button" onClick={search}>
                Buscar Hubble aquí
              </button>
              {status && <p role="status">{status}</p>}
              {results.length > 0 && (
                <label>
                  Observación Hubble
                  <select
                    aria-label="Observación Hubble"
                    value={
                      results.some((item) => item.dataset === source.dataset) ? source.dataset : ''
                    }
                    onChange={(event) => {
                      const selected = results.find((item) => item.dataset === event.target.value);
                      if (selected) onSourceChange(selected);
                    }}
                  >
                    <option value="">Selecciona una observación</option>
                    {results.map((item) => (
                      <option key={item.dataset} value={item.dataset}>
                        {item.title} · {item.releaseDate}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="survey-details">
                Recorte de 512 × 512 píxeles; posición fija hasta elegir otra observación. HLA no
                incluye datos posteriores a octubre de 2017.
              </p>
            </>
          )}
          <label htmlFor="comparison-instrument">Instrumento de {source.telescope}</label>
          <select
            className="survey-select"
            id="comparison-instrument"
            value={source.id}
            onChange={(event) =>
              onSourceChange(ARCHIVE_SURVEYS.find((item) => item.id === event.target.value))
            }
          >
            {ARCHIVE_SURVEYS.filter((item) => item.telescope === source.telescope).map((item) => (
              <option key={item.id} value={item.id}>
                {item.instrument}
              </option>
            ))}
          </select>
          <p className="survey-details">
            {mode === 'split' ? 'Izquierda: SPHEREx. Derecha: ' : 'Sobre SPHEREx: '}
            {source.title}. Misma RA/Dec y zoom. Cobertura parcial: un campo vacío no significa
            ausencia de objetos.
          </p>
          <button
            className="plain-button"
            onClick={() =>
              onViewChange(
                source.target ?? { longitude: 24.173958, latitude: 15.783667, fov: 0.14 },
              )
            }
          >
            {source.provider === 'Florida'
              ? 'Ver centro galáctico · Webb'
              : source.provider === 'HLA'
                ? 'Ver región del recorte Hubble'
                : 'Ver M74 · cobertura común'}
          </button>
          <p className="survey-details">
            {source.provider === 'Florida'
              ? 'Mosaico multifiltro del centro galáctico, Universidad de Florida. Teselas directas; cobertura parcial.'
              : source.provider === 'HLA'
                ? 'FITS científico de HLA/STScI con WCS original; carga directa, sin guardar imágenes en Cloudflare.'
                : 'Mosaico de archivo ESA; el proveedor puede no estar disponible.'}{' '}
            Las épocas no están sincronizadas: cambiar la fecha de SPHEREx no cambia este archivo.{' '}
            Fecha del archivo: {source.releaseDate}.
          </p>
          <a
            href={source.provider === 'HLA' ? 'https://hla.stsci.edu/' : source.url}
            target="_blank"
            rel="noreferrer"
          >
            Fuente y datos de {source.provider ?? 'ESA'}
          </a>
          {' · '}
          <a
            href="https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html"
            target="_blank"
            rel="noreferrer"
          >
            Datos científicos MAST
          </a>
          <p className="survey-details">
            Buscar en MAST: RA {view.longitude.toFixed(8)}°, Dec {view.latitude.toFixed(8)}°.
            Astroquery consulta los mismos archivos desde el entorno local.
          </p>
        </>
      )}
    </section>
  );
}
