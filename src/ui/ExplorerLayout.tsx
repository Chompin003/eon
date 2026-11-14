import { useState, type CSSProperties, type ReactNode } from 'react';
import { VIEW_LIMITS, type SkySource, type ViewerLayers, type ViewState } from '../shared';

function Icon({
  name,
  size = 18,
}: {
  name:
    | 'orbit'
    | 'arrow'
    | 'grid'
    | 'sliders'
    | 'reset'
    | 'expand'
    | 'mouse'
    | 'spark'
    | 'info'
    | 'plus'
    | 'minus';
  size?: number;
}) {
  const paths = {
    orbit: (
      <>
        <circle cx="12" cy="12" r="6" />
        <ellipse cx="12" cy="12" rx="11" ry="3.8" transform="rotate(-35 12 12)" />
        <circle cx="19.5" cy="6.5" r="1.3" fill="currentColor" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 12h16M12 4v16" />
      </>
    ),
    sliders: (
      <>
        <path d="M5 4v4m0 5v7M12 4v10m0 5v1M19 4v1m0 5v10" />
        <path d="M2 8h6m1 6h6m1-9h6" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6" />
      </>
    ),
    expand: (
      <>
        <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />
      </>
    ),
    mouse: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="6" />
        <path d="M12 3v6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

interface Props {
  source: SkySource;
  view: ViewState;
  layers: ViewerLayers;
  onViewChange: (next: ViewState) => void;
  onLayersChange: (next: ViewerLayers) => void;
  onReset: () => void;
  children: ReactNode;
}

export function ExplorerLayout({
  source,
  view,
  layers,
  onViewChange,
  onLayersChange,
  onReset,
  children,
}: Props) {
  const [showHelp, setShowHelp] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const zoom = (100 / view.fov).toFixed(1);
  const zoomProgress =
    ((VIEW_LIMITS.maxFov - view.fov) / (VIEW_LIMITS.maxFov - VIEW_LIMITS.minFov)) * 100;
  const setFov = (fov: number) => onViewChange({ ...view, fov });

  return (
    <div className={`app-shell ${immersive ? 'immersive' : ''}`}>
      <a className="skip-link" href="#explorer">
        Ir al explorador
      </a>
      <header className="topbar">
        <a className="brand" href="./" aria-label="SPHEREx Explorer, inicio">
          <span className="brand-symbol">
            <Icon name="orbit" size={33} />
          </span>
          <span>
            SPHEREx<span className="brand-secondary"> EXPLORER</span>
          </span>
        </a>
        <nav aria-label="Principal">
          <span className="nav-active">
            <span className="tiny-orbit" />
            Explorador
          </span>
          <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noreferrer">
            La misión <Icon name="arrow" size={13} />
          </a>
        </nav>
        <span className="prototype-badge">
          <span />
          PROTOTIPO 0.1
        </span>
      </header>

      <main id="explorer">
        <div className="page-heading">
          <div>
            <div className="eyebrow">UN UNIVERSO DE PERSPECTIVAS</div>
            <h1>
              Tu ventana al <span>cosmos.</span>
            </h1>
            <p>Muévete por el cielo. Cambia tu punto de vista. Empieza a explorar.</p>
          </div>
          <div className="heading-meta">
            <span className="status-dot" />
            ENTORNO EXPLORATORIO<span className="heading-meta-sub">NASA Space Apps Challenge</span>
          </div>
        </div>

        <div className="workspace">
          <aside className="source-panel" aria-label="Capas de visualización">
            <div className="panel-heading">
              <Icon name="grid" size={16} />
              <h2>Visualización</h2>
              <span className="small-count">01</span>
            </div>
            <p className="panel-caption">Una base para explorar el cielo.</p>
            <div className="source-card">
              <div className="source-thumbnail" aria-hidden="true">
                <div className="mini-sphere" />
                <span>360°</span>
              </div>
              <div className="source-card-text">
                <span className="selected-dot">✓</span>
                <h3>{source.title}</h3>
                <p>{source.description}</p>
              </div>
              <div className="source-tags">
                <span>PROCEDURAL</span>
                <span>360° × 180°</span>
              </div>
            </div>
            <div className="layer-section">
              <h3>CAPAS DE REFERENCIA</h3>
              <label className="toggle-row">
                <span>
                  <Icon name="grid" size={16} />
                  Cuadrícula
                </span>
                <input
                  type="checkbox"
                  checked={layers.grid}
                  onChange={(event) => onLayersChange({ ...layers, grid: event.target.checked })}
                />
                <span className="toggle" aria-hidden="true" />
              </label>
              <label className="toggle-row">
                <span>
                  <Icon name="spark" size={16} />
                  Puntos de referencia
                </span>
                <input
                  type="checkbox"
                  checked={layers.stars}
                  onChange={(event) => onLayersChange({ ...layers, stars: event.target.checked })}
                />
                <span className="toggle" aria-hidden="true" />
              </label>
            </div>
            <div className="demo-note">
              <Icon name="info" size={17} />
              <div>
                <strong>El primer paso de la misión</strong>
                <p>
                  Esta vista utiliza una textura de prueba. Los datos astronómicos llegarán en una
                  próxima etapa.
                </p>
              </div>
            </div>
            <div className="source-footer">
              <span className="status-dot" />
              FUENTE LOCAL · SIN DATOS REALES
            </div>
          </aside>

          <section className="viewport" aria-label="Visor del cielo">
            {children}
            <div className="viewport-vignette" aria-hidden="true" />
            <div className="viewport-top">
              <span className="live-label">
                <span />
                VISTA DEL CIELO
              </span>
              <button
                className="icon-button"
                onClick={() => setImmersive(!immersive)}
                aria-label={immersive ? 'Salir de vista ampliada' : 'Ampliar vista'}
                aria-pressed={immersive}
                title="Ampliar vista"
              >
                <Icon name="expand" size={17} />
              </button>
            </div>
            <div className="north-marker" aria-hidden="true">
              N<span>╵</span>
            </div>
            <div className="reticle" aria-hidden="true">
              <span />
              <span />
              <i />
            </div>
            <div className="coordinate-marker" aria-hidden="true">
              ESFERA CELESTE <span>/</span> 360°
            </div>
            <div className="viewport-bottom">
              <div className="coordinates">
                <div>
                  <span>LONGITUD</span>
                  <output data-testid="longitude">
                    {view.longitude.toFixed(1)}
                    <small>°</small>
                  </output>
                </div>
                <div>
                  <span>LATITUD</span>
                  <output data-testid="latitude">
                    {view.latitude > 0 ? '+' : ''}
                    {view.latitude.toFixed(1)}
                    <small>°</small>
                  </output>
                </div>
              </div>
              <div className="view-scale">
                <span>CAMPO DE VISIÓN</span>
                <output data-testid="viewport-fov">{view.fov.toFixed(0)}°</output>
                <div className="scale-rule" />
              </div>
            </div>
          </section>

          <aside className="controls-panel" aria-label="Controles de navegación">
            <div className="panel-heading">
              <Icon name="sliders" size={17} />
              <h2>Tu perspectiva</h2>
            </div>
            <p className="panel-caption">Acércate un poco más.</p>
            <div className="zoom-readout">
              <span>ZOOM</span>
              <output data-testid="zoom">
                {zoom}
                <small>×</small>
              </output>
            </div>
            <div className="zoom-slider">
              <button
                className="icon-button"
                aria-label="Alejar"
                onClick={() => setFov(Math.min(VIEW_LIMITS.maxFov, view.fov + 5))}
                disabled={view.fov >= VIEW_LIMITS.maxFov}
              >
                <Icon name="minus" size={15} />
              </button>
              <input
                aria-label="Zoom"
                type="range"
                min={0}
                max={75}
                step={1}
                value={100 - view.fov}
                style={{ '--range-progress': `${zoomProgress}%` } as CSSProperties}
                onChange={(event) => setFov(100 - Number(event.target.value))}
              />
              <button
                className="icon-button"
                aria-label="Acercar"
                onClick={() => setFov(Math.max(VIEW_LIMITS.minFov, view.fov - 5))}
                disabled={view.fov <= VIEW_LIMITS.minFov}
              >
                <Icon name="plus" size={15} />
              </button>
            </div>
            <div className="range-labels">
              <span>Panorámica</span>
              <span>Detalle</span>
            </div>
            <div className="fov-row">
              <span>Campo de visión</span>
              <output data-testid="control-fov">{view.fov.toFixed(0)}°</output>
            </div>
            <div className="presets" aria-label="Vistas predefinidas">
              {[
                { label: 'Amplia', fov: 100 },
                { label: 'Natural', fov: 75 },
                { label: 'Cerca', fov: 35 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className={Math.abs(view.fov - preset.fov) < 0.5 ? 'is-active' : ''}
                  aria-pressed={Math.abs(view.fov - preset.fov) < 0.5}
                  onClick={() => setFov(preset.fov)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button className="reset-button" onClick={onReset}>
              <Icon name="reset" size={16} />
              Reset View<span>↺</span>
            </button>
            <div className="navigation-guide" id="navigation-help">
              <h3>EL CIELO ESTÁ EN TUS MANOS</h3>
              <div>
                <span className="guide-icon">
                  <Icon name="mouse" size={18} />
                </span>
                <p>
                  <strong>Arrastra para explorar</strong>
                  <span>Gira la vista en cualquier dirección.</span>
                </p>
              </div>
              <div>
                <span className="guide-icon scroll-icon">↕</span>
                <p>
                  <strong>Desplázate para acercar</strong>
                  <span>Usa la rueda o pellizca la pantalla.</span>
                </p>
              </div>
            </div>
            <button
              className="help-button"
              aria-expanded={showHelp}
              aria-controls="keyboard-help"
              onClick={() => setShowHelp(!showHelp)}
            >
              <Icon name="info" size={14} />
              Atajos de teclado<span>{showHelp ? '−' : '+'}</span>
            </button>
            {showHelp && (
              <p className="keyboard-help" id="keyboard-help">
                Selecciona el cielo y usa las flechas para girar, + / − para el zoom y Home para
                restablecer. Shift + flechas mueve más rápido.
              </p>
            )}
          </aside>
        </div>
        <div className="under-workspace">
          <span>
            <span className="status-dot" />
            RENDERIZADO EN TU NAVEGADOR
          </span>
          <p>
            <Icon name="mouse" size={13} />
            Arrastra para mirar alrededor<span className="divider">/</span>Scroll para acercar
          </p>
          <span>CHECKERBOARD / v0.1</span>
        </div>
      </main>
      <footer className="site-footer">
        <span>Un cielo. Infinitas posibilidades.</span>
        <span>
          Hecho para explorar juntos <span className="footer-star">✦</span> SPHEREx Explorer
        </span>
      </footer>
    </div>
  );
}
