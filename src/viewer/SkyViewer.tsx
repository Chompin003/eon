import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  normalizeView,
  type DisplayMode,
  type SkySource,
  type ViewerLayers,
  type ViewState,
  type SkyProjection,
  type SkyProjectionWindow,
  type BufferStatus,
  type ArchiveHiPSSource,
} from '../shared';
import { FrameBuffer } from './frameBuffer';
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
  onBufferStatus?: (status: BufferStatus) => void;
  comparisonSource?: ArchiveHiPSSource;
}

export function SkyViewer(props: Props) {
  const [readyPanes, setReadyPanes] = useState<Record<string, string>>({});
  const mode = props.mode ?? 'mono';
  const comparison = props.comparisonSource;
  const twoPanes = Boolean(comparison) || mode === 'split';
  const bufferedComparison = mode === 'split' && !comparison;
  const sequence = props.source.kind === 'fits' ? props.source.sequence : undefined;
  const bufferKey = `${sequence?.id ?? ''}:${sequence?.attempt ?? 0}`;
  const buffer = useMemo(
    () => (sequence ? new FrameBuffer(sequence.frames) : undefined),
    [bufferKey],
  );
  const [preparation, setPreparation] = useState<BufferStatus>({
    total: 0,
    prepared: 0,
    ready: 0,
    failed: 0,
    bytes: 0,
  });
  const [gpu, setGPU] = useState<Record<string, { key: string; count: number; failed: number }>>(
    {},
  );
  useEffect(() => {
    if (!buffer) {
      setPreparation({ total: 0, prepared: 0, ready: 0, failed: 0, bytes: 0 });
      return;
    }
    const controller = new AbortController();
    const update = () => setPreparation(buffer.status());
    update();
    const unsubscribe = buffer.subscribe(update);
    void buffer.load(controller.signal);
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [buffer]);
  const mainGPU = gpu.main?.key === bufferKey ? gpu.main.count : 0;
  const comparisonGPU = gpu.comparison?.key === bufferKey ? gpu.comparison.count : 0;
  useEffect(() => {
    props.onBufferStatus?.({
      ...preparation,
      sequenceId: sequence?.id,
      ready: bufferedComparison ? Math.min(mainGPU, comparisonGPU) : mainGPU,
      failed:
        preparation.failed +
        (gpu.main?.key === bufferKey ? gpu.main.failed : 0) +
        (bufferedComparison && gpu.comparison?.key === bufferKey ? gpu.comparison.failed : 0),
    });
  }, [
    preparation,
    bufferedComparison,
    mainGPU,
    comparisonGPU,
    gpu,
    bufferKey,
    props.onBufferStatus,
  ]);
  const progress = (pane: string, count: number, failed: number) =>
    setGPU((current) =>
      current[pane]?.key === bufferKey &&
      current[pane].count === count &&
      current[pane].failed === failed
        ? current
        : { ...current, [pane]: { key: bufferKey, count, failed } },
    );
  const signature = JSON.stringify([
    props.source.id,
    props.source.kind === 'hips' ? props.source.frame : bufferKey,
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
          buffer={buffer}
          onGPUProgress={(count, failed) => progress('main', count, failed)}
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
            buffer={comparison ? undefined : buffer}
            onGPUProgress={(count, failed) => progress('comparison', count, failed)}
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
  buffer,
  onGPUProgress,
}: Props & { buffer?: FrameBuffer; onGPUProgress?: (count: number, failed: number) => void }) {
  const documentKey =
    source.kind === 'fits'
      ? source.sequence
        ? `${source.sequence.id}:${source.sequence.attempt ?? 0}`
        : source.url
      : source.kind === 'archive-hips'
        ? source.url
        : source.kind;
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef({
    source,
    view,
    onViewChange,
    mode,
    secondFrame,
    overlay,
    onReadyChange,
    buffer,
    onGPUProgress,
  });
  const engineReady = useRef(false);
  const sent = useRef(new Set<string>());
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [projection, setProjection] = useState<SkyProjection>();
  const [covered, setCovered] = useState<boolean>();
  const [coverageError, setCoverageError] = useState(false);
  const archive = source.kind === 'archive-hips';
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    current.current = {
      source,
      view,
      onViewChange,
      mode,
      secondFrame,
      overlay,
      onReadyChange,
      buffer,
      onGPUProgress,
    };
    const wireSource =
      source.kind === 'fits' && source.sequence
        ? { ...source, sequence: { ...source.sequence, frames: [] } }
        : source;
    frame.current?.contentWindow?.postMessage(
      { type: 'sky:configure', source: wireSource, view, mode, secondFrame, overlay },
      location.origin,
    );
  }, [
    source,
    view,
    onViewChange,
    mode,
    secondFrame,
    overlay,
    onReadyChange,
    buffer,
    onGPUProgress,
  ]);

  const flush = () => {
    if (!engineReady.current) return;
    const { buffer, source } = current.current;
    if (!buffer || source.kind !== 'fits' || !source.sequence) return;
    for (const [id, entry] of buffer.entries) {
      if (sent.current.has(id)) continue;
      sent.current.add(id);
      const bytes = entry.bytes.slice(0);
      frame.current?.contentWindow?.postMessage(
        { type: 'sky:cache-frame', sequenceId: source.sequence.id, frame: entry.frame, bytes },
        location.origin,
        [bytes],
      );
    }
  };
  useEffect(() => {
    flush();
    return buffer?.subscribe(flush);
  }, [buffer, attempt]);

  useEffect(() => {
    current.current.onReadyChange?.(false);
    setConnected(false);
    setProjection(undefined);
    engineReady.current = false;
    sent.current.clear();
    current.current.onGPUProgress?.(0, 0);
    setCovered(undefined);
    setCoverageError(false);
  }, [documentKey, attempt]);

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
        const wireSource =
          source.kind === 'fits' && source.sequence
            ? { ...source, sequence: { ...source.sequence, frames: [] } }
            : source;
        event.source?.postMessage(
          { type: 'sky:configure', source: wireSource, view, mode, secondFrame, overlay },
          { targetOrigin: location.origin },
        );
      } else if (message.type === 'sky:engine-ready') {
        if (current.current.source.kind === 'fits') clearTimeout(timeout);
        engineReady.current = true;
        flush();
      } else if (message.type === 'sky:buffer-progress') {
        current.current.onGPUProgress?.(message.count, message.failed ?? 0);
      } else if (message.type === 'sky:ready') {
        if (message.frameId && message.frameId !== current.current.source.id) return;
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
