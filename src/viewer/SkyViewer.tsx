import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  normalizeView,
  type DisplayMode,
  type SkySource,
  type ViewerLayers,
  type ViewState,
  type SkyProjection,
  type SkyProjectionWindow,
  type ArchiveHiPSSource,
} from '../shared';
const CheckerboardViewer = lazy(() =>
  import('./CheckerboardViewer').then((module) => ({ default: module.CheckerboardViewer })),
);

interface Props {
  source: SkySource;
  view: ViewState;
  layers: ViewerLayers;
  onViewChange: (view: ViewState) => void;
  mode?: DisplayMode;
  secondFrame?: number;
  overlay?: boolean;
  onReadyChange?: (ready: boolean) => void;
  renderAnnotations?: (projection: SkyProjection) => ReactNode;
  comparisonSource?: ArchiveHiPSSource;
}

export function SkyViewer(props: Props) {
  const [readyPanes, setReadyPanes] = useState<Record<string, string>>({});
  const mode = props.mode ?? 'mono';
  const comparison = props.comparisonSource;
  const twoPanes = Boolean(comparison) || mode === 'split';
  const signature = JSON.stringify([
    props.source,
    props.secondFrame,
    props.overlay,
    mode,
    comparison,
  ]);
  const ready =
    readyPanes.main === signature &&
    (Boolean(comparison) || mode !== 'split' || readyPanes.comparison === signature);
  useEffect(() => {
    props.onReadyChange?.(Boolean(ready));
  }, [props.onReadyChange, ready]);
  if (props.source.kind === 'checkerboard')
    return (
      <Suspense fallback={null}>
        <CheckerboardViewer {...props} source={props.source} />
      </Suspense>
    );
  return (
    <div className={twoPanes ? 'sky-split' : 'sky-single'}>
      <div className="sky-pane">
        <HiPSViewer
          {...props}
          mode={mode === 'split' ? 'mono' : mode}
          onReadyChange={(value) =>
            setReadyPanes((current) =>
              current.main === (value ? signature : '')
                ? current
                : { ...current, main: value ? signature : '' },
            )
          }
        />
        {twoPanes && (
          <span className="pane-label">
            {comparison
              ? `SPHEREx · ${props.source.kind === 'fits' ? 'exposición' : 'mosaico'}`
              : 'Blanco y negro'}
          </span>
        )}
      </div>
      {twoPanes && (
        <div className="sky-pane">
          <HiPSViewer
            {...props}
            source={comparison ?? props.source}
            mode={comparison ? 'mono' : 'color'}
            onReadyChange={(value) =>
              setReadyPanes((current) =>
                current.comparison === (value ? signature : '')
                  ? current
                  : { ...current, comparison: value ? signature : '' },
              )
            }
          />
          <span className="pane-label">
            {comparison
              ? comparison.title
              : props.source.kind === 'fits'
                ? 'Pseudocolor'
                : 'Color falso · A rojo / B azul'}
          </span>
        </div>
      )}
    </div>
  );
}

function HiPSViewer({
  source,
  view,
  onViewChange,
  mode,
  secondFrame,
  overlay,
  onReadyChange,
  renderAnnotations,
}: Props) {
  const documentKey =
    source.kind === 'fits' || source.kind === 'archive-hips' ? source.url : source.kind;
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef({ source, view, onViewChange, mode, secondFrame, overlay, onReadyChange });
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [projection, setProjection] = useState<SkyProjection>();
  const [covered, setCovered] = useState<boolean>();
  const [coverageError, setCoverageError] = useState(false);
  const archive = source.kind === 'archive-hips';
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    current.current = { source, view, onViewChange, mode, secondFrame, overlay, onReadyChange };
    frame.current?.contentWindow?.postMessage(
      { type: 'sky:configure', source, view, mode, secondFrame, overlay },
      location.origin,
    );
  }, [source, view, onViewChange, mode, secondFrame, overlay, onReadyChange]);

  useEffect(() => {
    current.current.onReadyChange?.(false);
    setConnected(false);
    setProjection(undefined);
    setCovered(undefined);
    setCoverageError(false);
  }, [source, mode, secondFrame, overlay, attempt]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () =>
        setError(
          `${archive ? 'ESA' : 'IRSA'} o el visor tardaron demasiado. Revisa tu conexión e inténtalo otra vez.`,
        ),
      source.kind === 'fits' ? 70000 : 30000,
    );
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'sky:boot') {
        const { source, view, mode, secondFrame, overlay } = current.current;
        event.source?.postMessage(
          { type: 'sky:configure', source, view, mode, secondFrame, overlay },
          { targetOrigin: location.origin },
        );
      } else if (message.type === 'sky:ready') {
        clearTimeout(timeout);
        setConnected(true);
        setProjection(
          (frame.current?.contentWindow as SkyProjectionWindow | null)?.spherexProjection,
        );
        current.current.onReadyChange?.(true);
        setError('');
      } else if (message.type === 'sky:error' && typeof message.message === 'string') {
        clearTimeout(timeout);
        setError(message.message);
        setProjection(undefined);
        current.current.onReadyChange?.(false);
      } else if (message.type === 'sky:view') {
        const next = message.view;
        if (next && [next.longitude, next.latitude, next.fov].every(Number.isFinite)) {
          current.current.onViewChange(normalizeView(next));
        }
      } else if (message.type === 'sky:coverage') {
        if (typeof message.covered === 'boolean') setCovered(message.covered);
        setCoverageError(message.covered === null);
      } else if (message.type === 'sky:escape') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
    };
    window.addEventListener('message', receive);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
    };
  }, [attempt, documentKey, source.kind]);

  return (
    <div
      className="sky-canvas"
      data-connected={connected}
      data-telescope={archive ? source.telescope : 'SPHEREx'}
    >
      {/* The isolated document owns Aladin's WASM, events and animation loop.
          Removing it releases all of these, including during React StrictMode. */}
      <iframe
        key={`${documentKey}:${attempt}`}
        ref={frame}
        src="/sky.html"
        title={archive ? `Cielo ${source.telescope}` : 'Cielo SPHEREx'}
        className="hips-frame"
      />
      {connected && projection && renderAnnotations?.(projection)}
      {archive && connected && (covered === false || coverageError) && (
        <div className="coverage-notice" role="status">
          {covered === false
            ? 'El centro está fuera de la cobertura de este mosaico.'
            : 'No se pudo verificar la cobertura.'}{' '}
          {source.telescope} no cubre todo el cielo. Prueba M74 o busca otra posición.
        </div>
      )}
      {!connected && !error && (
        <div className="viewer-loading" role="status">
          {archive ? `Conectando con ${source.title} / ESA…` : 'Conectando con SPHEREx / IRSA…'}
        </div>
      )}
      {error && (
        <div className="viewer-error" role="alert">
          <strong>No se pudo cargar {archive ? source.title : 'SPHEREx'}</strong>
          <p>{error}</p>
          <button
            className="plain-button"
            onClick={() => {
              setError('');
              setConnected(false);
              setAttempt(attempt + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
