import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fovToZoomPosition,
  opticalZoom,
  zoomPositionToFov,
  TIMELINE_LIMITS,
  type ObservationEpoch,
  type TimelineState,
  type ViewState,
} from '../shared';
import { FloatingPanel } from './FloatingPanel';

interface Props {
  view: ViewState;
  epochs: readonly ObservationEpoch[];
  timeline: TimelineState;
  onViewChange: (next: ViewState) => void;
  onTimelineChange: (next: TimelineState) => void;
  onReset: () => void;
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
  epochs,
  timeline,
  onViewChange,
  onTimelineChange,
  onReset,
  coordinateTools,
  drawingTools,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const activeEpoch = epochs[timeline.epochIndex];
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
      <FloatingPanel open={open} onClose={close}>
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
            <span>Campo vertical</span>
            <output data-testid="control-fov">{formatFieldOfView(view.fov)}</output>
          </div>
          <button className="text-button" onClick={onReset}>
            Restablecer vista
          </button>
        </section>

        <section className="control-section" aria-labelledby="time-heading">
          <div className="section-title">
            <h2 id="time-heading">Tiempo</h2>
            <time data-testid="epoch-date" dateTime={activeEpoch?.dateUtc}>
              {activeEpoch?.dateUtc ?? 'Sin fechas'}
            </time>
          </div>
          <input
            aria-label="Fecha"
            type="range"
            min="0"
            max={Math.max(0, epochs.length - 1)}
            step="1"
            value={timeline.epochIndex}
            disabled={epochs.length < 2}
            onChange={(e) => onTimelineChange({ ...timeline, epochIndex: Number(e.target.value) })}
          />
          <div className="time-endpoints">
            <span>{epochs[0]?.dateUtc.slice(0, 4) ?? '—'}</span>
            <span>{epochs.at(-1)?.dateUtc.slice(0, 4) ?? '—'}</span>
          </div>
          <div className="interval-row">
            <label htmlFor="blink-interval">Intervalo</label>
            <output htmlFor="blink-interval" data-testid="interval">
              {timeline.intervalMs} ms
            </output>
          </div>
          <input
            id="blink-interval"
            aria-label="Intervalo entre fechas"
            type="range"
            min={TIMELINE_LIMITS.minIntervalMs}
            max={TIMELINE_LIMITS.maxIntervalMs}
            step="50"
            value={timeline.intervalMs}
            onChange={(e) => onTimelineChange({ ...timeline, intervalMs: Number(e.target.value) })}
          />
          <div className="time-actions">
            <button
              className="plain-button"
              disabled={epochs.length < 2}
              aria-pressed={timeline.playing}
              onClick={() => onTimelineChange({ ...timeline, playing: !timeline.playing })}
            >
              {timeline.playing ? 'Pausar' : 'Reproducir'}
            </button>
            <span>Fechas de prueba · textura fija</span>
          </div>
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
