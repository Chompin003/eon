import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  normalizeView,
  type DisplayMode,
  type SkySource,
  type ViewerLayers,
  type ViewState,
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
}

export function SkyViewer(props: Props) {
  const [readyPanes, setReadyPanes] = useState<Record<string, string>>({});
  const mode = props.mode ?? 'mono';
  const signature = JSON.stringify([props.source, props.secondFrame, props.overlay, mode]);
  const ready =
    readyPanes.main === signature && (mode !== 'split' || readyPanes.comparison === signature);
  useEffect(() => {
    props.onReadyChange?.(ready);
  }, [props.onReadyChange, ready]);
  if (props.source.kind === 'checkerboard')
    return (
      <Suspense fallback={null}>
        <CheckerboardViewer {...props} source={props.source} />
      </Suspense>
    );
  return (
    <div className={mode === 'split' ? 'sky-split' : 'sky-single'}>
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
        {mode === 'split' && <span className="pane-label">Blanco y negro</span>}
      </div>
      {mode === 'split' && (
        <div className="sky-pane">
          <HiPSViewer
            {...props}
            mode="color"
            onReadyChange={(value) =>
              setReadyPanes((current) =>
                current.comparison === (value ? signature : '')
                  ? current
                  : { ...current, comparison: value ? signature : '' },
              )
            }
          />
          <span className="pane-label">
            {props.source.kind === 'fits' ? 'Pseudocolor' : 'Color falso · A rojo / B azul'}
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
}: Props) {
  const documentKey = source.kind === 'fits' ? source.url : source.kind;
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef({ source, view, onViewChange, mode, secondFrame, overlay, onReadyChange });
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
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
  }, [source, mode, secondFrame, overlay, attempt]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () =>
        setError('IRSA o el visor tardaron demasiado. Revisa tu conexión e inténtalo otra vez.'),
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
        current.current.onReadyChange?.(true);
        setError('');
      } else if (message.type === 'sky:error' && typeof message.message === 'string') {
        clearTimeout(timeout);
        setError(message.message);
        current.current.onReadyChange?.(false);
      } else if (message.type === 'sky:view') {
        const next = message.view;
        if (next && [next.longitude, next.latitude, next.fov].every(Number.isFinite)) {
          current.current.onViewChange(normalizeView(next));
        }
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
    <div className="sky-canvas" data-connected={connected}>
      {/* The isolated document owns Aladin's WASM, events and animation loop.
          Removing it releases all of these, including during React StrictMode. */}
      <iframe
        key={`${documentKey}:${attempt}`}
        ref={frame}
        src="/sky.html"
        title="Cielo SPHEREx"
        className="hips-frame"
      />
      {!connected && !error && (
        <div className="viewer-loading" role="status">
          Conectando con SPHEREx / IRSA…
        </div>
      )}
      {error && (
        <div className="viewer-error" role="alert">
          <strong>No se pudo cargar SPHEREx</strong>
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
