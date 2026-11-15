import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fovToZoomPosition,
  opticalZoom,
  zoomPositionToFov,
  type DisplayMode,
  type ViewState,
  type SurveyMetadata,
} from '../shared';
import { FloatingPanel } from './FloatingPanel';

interface Props {
  view: ViewState;
  onViewChange: (next: ViewState) => void;
  onReset: () => void;
  metadata?: SurveyMetadata;
  spectralFrame: number;
  onSpectralFrameChange: (frame: number) => void;
  secondFrame: number;
  onSecondFrameChange: (frame: number) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  overlay: boolean;
  onOverlayChange: (overlay: boolean) => void;
  showingObservation: boolean;
  observationDate?: string;
  timeTools: ReactNode;
  /** Modules mount through App.tsx, without importing sibling modules. */
  coordinateTools?: ReactNode;
  drawingTools?: ReactNode;
  children: ReactNode;
}

export function formatFieldOfView(fov: number): string {
  if (fov >= 1) return `${fov.toFixed(2)}°`;
  if (fov * 60 >= 1) return `${(fov * 60).toFixed(2)}′`;
  return `${(fov * 3600).toFixed(2)}″`;
}

export function ExplorerLayout({
  view,
  onViewChange,
  onReset,
  metadata,
  spectralFrame,
  onSpectralFrameChange,
  secondFrame,
  onSecondFrameChange,
  displayMode,
  onDisplayModeChange,
  overlay,
  onOverlayChange,
  showingObservation,
  observationDate,
  timeTools,
  coordinateTools,
  drawingTools,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);

  return (
    <main className="viewer-workspace" aria-label="SPHEREx Explorer">
      <div className="viewer-surface">{children}</div>
      <p className="sr-only" id="navigation-help">
        Arrastra para girar. Rueda o pellizco para zoom. Flechas para navegar, + y − para zoom y
        Home para reiniciar.
      </p>
      <button
        ref={toggle}
        className="panel-toggle"
        aria-label={open ? 'Ocultar controles' : 'Mostrar controles'}
        aria-expanded={open}
        aria-controls={open ? 'viewer-controls' : undefined}
        onClick={() => setOpen(!open)}
        title="Controles"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d={open ? 'm12 5-5 5 5 5' : 'm8 5 5 5-5 5'} />
        </svg>
      </button>
      <FloatingPanel open={open} onClose={close} observationDate={observationDate}>
        <section className="control-section" aria-labelledby="survey-heading">
          <div className="section-title">
            <h2 id="survey-heading">SPHEREx DR1</h2>
            <span>IRSA</span>
          </div>
          <div className="display-modes" aria-label="Modo de imagen">
            {(
              [
                ['mono', 'Blanco y negro'],
                ['color', 'Color'],
                ['split', 'Pantalla dividida'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                className="plain-button"
                aria-pressed={displayMode === mode}
                onClick={() => onDisplayModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          {showingObservation && (
            <p className="survey-details">
              Exposición individual. Elige detector y fecha en Tiempo. Color muestra pseudocolor de
              esta misma imagen.
            </p>
          )}
          <div hidden={showingObservation}>
            <label htmlFor="spectral-channel">Canal A · longitud de onda</label>
            <select
              id="spectral-channel"
              className="survey-select"
              value={spectralFrame}
              disabled={!metadata || showingObservation}
              onChange={(event) => onSpectralFrameChange(Number(event.target.value))}
            >
              {metadata?.channels.map(({ frame, wavelengthUm }) => (
                <option key={frame} value={frame}>
                  {wavelengthUm.toFixed(3)} µm · D{Math.floor(frame / 17) + 1} / canal{' '}
                  {(frame % 17) + 1}
                </option>
              ))}
            </select>
            <label htmlFor="second-channel">Canal B · longitud de onda</label>
            <select
              id="second-channel"
              className="survey-select"
              value={secondFrame}
              disabled={!metadata || showingObservation}
              onChange={(event) => onSecondFrameChange(Number(event.target.value))}
            >
              {metadata?.channels.map(({ frame, wavelengthUm }) => (
                <option key={frame} value={frame}>
                  {wavelengthUm.toFixed(3)} µm · D{Math.floor(frame / 17) + 1} / canal{' '}
                  {(frame % 17) + 1}
                </option>
              ))}
            </select>
            <label className="overlay-toggle">
              <input
                type="checkbox"
                checked={overlay}
                disabled={showingObservation}
                onChange={(event) => onOverlayChange(event.target.checked)}
              />{' '}
              Superponer A y B en blanco y negro
            </label>
          </div>
          <details className="survey-details">
            <summary>Datos, límites y referencias</summary>
            <p>
              {showingObservation
                ? 'Exposición individual: B/N o pseudocolor viridis de una sola imagen. Los canales del mosaico no se aplican a esta exposición.'
                : '100 canales utilizables de 102. Color falso: A rojo + B azul. En pantalla dividida: B/N a la izquierda, color a la derecha; navegación sincronizada.'}
            </p>
            <p>
              Mosaico infrarrojo · intensidad en escala de grises.
              <br />
              Muestreo nativo: {metadata?.pixelScaleArcsec.toFixed(2) ?? '—'}″/píxel. Más zoom
              amplía esos píxeles.
            </p>
            <p>
              Observaciones: {metadata?.observationStart ?? '—'} – {metadata?.observationEnd ?? '—'}
              .<br />
              Publicación del mosaico: {metadata?.releaseDate.slice(0, 10) ?? '—'}.
            </p>
            <a
              href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
              target="_blank"
              rel="noreferrer"
            >
              NASA / SPHEREx · Caltech/IPAC
            </a>
            {' · '}
            <a
              href="https://github.com/cds-astro/aladin-lite/tree/v3.8.2"
              target="_blank"
              rel="noreferrer"
            >
              Aladin Lite · CDS
            </a>
            {' · '}
            <a href="/vendor/aladin/LICENSE.txt" target="_blank" rel="noreferrer">
              LGPL
            </a>
          </details>
        </section>
        <section className="control-section" aria-labelledby="zoom-heading">
          <div className="section-title">
            <h2 id="zoom-heading">Zoom</h2>
            <output data-testid="zoom">
              {new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(
                opticalZoom(view.fov),
              )}
              ×
            </output>
          </div>
          <input
            aria-label="Zoom"
            type="range"
            min="0"
            max="1000"
            step="1"
            value={fovToZoomPosition(view.fov)}
            onChange={(e) =>
              onViewChange({ ...view, fov: zoomPositionToFov(Number(e.target.value)) })
            }
          />
          <div className="control-detail">
            <span>Campo horizontal</span>
            <output data-testid="control-fov">{formatFieldOfView(view.fov)}</output>
          </div>
          <button className="text-button" onClick={onReset}>
            Restablecer vista
          </button>
        </section>

        <section className="control-section" aria-labelledby="time-heading">
          <div className="section-title">
            <h2 id="time-heading">Tiempo · exposiciones reales</h2>
          </div>
          {timeTools}
        </section>

        <section
          className="control-section"
          aria-labelledby="coordinates-heading"
          data-module-slot="coordinates"
        >
          <div className="section-title">
            <h2 id="coordinates-heading">Coordenadas</h2>
            <span>J2000</span>
          </div>
          {coordinateTools ?? (
            <div className="module-placeholder">
              <div className="coordinate-field">
                <span>RA</span>
                <span>— h — m — s</span>
              </div>
              <div className="coordinate-field">
                <span>Dec</span>
                <span>± — ° — ′ — ″</span>
              </div>
              <p>Módulo por conectar</p>
            </div>
          )}
        </section>
        <section className="control-section" aria-labelledby="drawing-heading">
          <div className="section-title">
            <h2 id="drawing-heading">Paint</h2>
          </div>
          {drawingTools ?? <p className="module-note">Módulo por conectar</p>}
        </section>
      </FloatingPanel>
    </main>
  );
}
