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
              Solapada
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
            onClick={() => onViewChange({ longitude: 24.173958, latitude: 15.783667, fov: 0.14 })}
          >
            Ver M74 · cobertura común
          </button>
          <p className="survey-details">
            Vista multifiltro de archivo para orientación, no fotometría ni comparación temporal.
            Las épocas no están sincronizadas: cambiar la fecha de SPHEREx no cambia este mosaico.
            Publicación del mosaico: {source.releaseDate}; no es la fecha de cada exposición.{' '}
            {source.telescope === 'Hubble'
              ? 'Estos mosaicos de Hubble recopilan observaciones hasta agosto de 2015.'
              : 'Este mosaico de Webb es una instantánea del archivo publicada en 2024.'}
          </p>
          <a href={source.url} target="_blank" rel="noreferrer">
            Fuente y cobertura ESA
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
