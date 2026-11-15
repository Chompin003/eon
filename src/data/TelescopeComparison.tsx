import { ARCHIVE_SURVEYS, type ArchiveHiPSSource, type ViewState } from '../shared';

interface Props {
  source?: ArchiveHiPSSource;
  onSourceChange: (source: ArchiveHiPSSource | undefined) => void;
  view: ViewState;
  onViewChange: (next: ViewState) => void;
}

export function TelescopeComparison({ source, onSourceChange, view, onViewChange }: Props) {
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
            Izquierda: SPHEREx. Derecha: {source.title}. Misma RA/Dec y zoom. Cobertura parcial: un
            campo vacío no significa ausencia de objetos.
          </p>
          <button
            className="plain-button"
            onClick={() => onViewChange({ longitude: 24.173958, latitude: 15.783667, fov: 0.14 })}
          >
            Ver M74 · cobertura común
          </button>
          <p className="survey-details">
            Vista multifiltro de archivo para orientación, no fotometría ni comparación temporal.
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
