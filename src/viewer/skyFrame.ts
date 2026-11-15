import {
  DEFAULT_VIEW,
  VIEW_LIMITS,
  normalizeView,
  type FITSSource,
  type HiPSSource,
  type ViewState,
  type SkyProjectionWindow,
} from '../shared';
import { cubeFileFrequency } from './spectral';
import { displayFits } from './sip';
import './skyFrame.css';

interface Layer {
  setOptions(options: Record<string, unknown>): void;
}
interface Survey extends Layer {
  query: Promise<Survey>;
  creatorDid: string;
  emMin: number;
  emMax: number;
  cubeDepth: number;
  cubeFirstFrame: number;
  setFrequency(frequency: { value: number; unit: 'Hz' }): void;
}
interface AladinView {
  getRaDec(): [number, number];
  getFov(): [number, number];
  getSize(): [number, number];
  pix2world(x: number, y: number): [number, number];
  world2pix(ra: number, dec: number): [number, number] | undefined;
  gotoRaDec(ra: number, dec: number): void;
  setFoV(fov: number): void;
  setFoVRange(min: number, max: number): void;
  setOverlayImageLayer(layer: Layer, id: string): Layer;
  getOverlayImageLayer(id: string): Layer | undefined;
  removeImageLayer(id: string): void;
  on(event: string, callback: () => void): void;
}
interface AladinAPI {
  init: Promise<void>;
  aladin(host: HTMLElement, options: Record<string, unknown>): AladinView;
  HiPS(
    id: string,
    options: {
      url: string;
      name: string;
      successCallback: (survey: Survey) => void;
      errorCallback: () => void;
    },
  ): Survey;
  image(
    url: string,
    options: {
      name: string;
      imgFormat: string;
      colormap: string;
      stretch: string;
      successCallback: (ra: number, dec: number, fov: number) => void;
      errorCallback: () => void;
    },
  ): Layer;
}
interface Configuration {
  source: HiPSSource | FITSSource;
  view: ViewState;
  mode: 'mono' | 'color';
  secondFrame: number;
  overlay: boolean;
}
const host = document.getElementById('sky')!;
let A: AladinAPI;
let engine: AladinView | undefined;
let surveys: Survey[] = [];
let configuration: Configuration | undefined;
let starting = false;
let applying = false;
let layerKey = '';
let revision = 0;
let loading = false;
const projectionListeners = new Set<() => void>();
const send = (message: object) => parent.postMessage(message, location.origin);
const sameView = (a: ViewState, b: ViewState) =>
  Math.abs(((a.longitude - b.longitude + 540) % 360) - 180) < 1e-8 &&
  Math.abs(a.latitude - b.latitude) < 1e-8 &&
  Math.abs(a.fov - b.fov) < 1e-9;

function publishView(notify = true) {
  if (!engine || applying) return;
  const [ra, dec] = engine.getRaDec();
  const fov = engine.getFov()[0];
  const view = normalizeView({ longitude: ra, latitude: dec, fov });
  if (Math.abs(fov - view.fov) > 1e-10) engine.setFoV(view.fov);
  const [width, height] = engine.getSize();
  const center = engine.pix2world(width / 2, height / 2);
  host.dataset.ra = String(center[0]);
  host.dataset.dec = String(center[1]);
  host.dataset.fov = String(fov);
  for (const listener of projectionListeners) listener();
  if (notify && configuration && !sameView(view, configuration.view))
    send({ type: 'sky:view', view });
}

function configureSurveys() {
  if (!configuration || configuration.source.kind !== 'hips') return;
  const { source, secondFrame, mode, overlay } = configuration;
  const frames = [source.frame, secondFrame];
  surveys.forEach((survey, index) => {
    // Published spectral layers are zero-based; IRSA tile filenames start at 1.
    survey.setFrequency({
      value: cubeFileFrequency(
        frames[index],
        survey.cubeFirstFrame,
        survey.cubeDepth,
        survey.emMin,
        survey.emMax,
      ),
      unit: 'Hz',
    });
    survey.setOptions({
      colormap: mode === 'color' ? (index === 0 ? 'red' : 'blue') : 'native',
      additive: mode === 'color',
      // Equal 50% weights also avoid Aladin's full-opacity layer culling,
      // which otherwise omits A even when B requests additive blending.
      opacity: mode === 'color' ? 0.5 : index === 0 ? 1 : overlay ? 0.5 : 0,
    });
  });
  host.dataset.frame = String(source.frame);
  host.dataset.secondFrame = String(secondFrame);
  host.dataset.mode = mode;
}

async function updateLayers() {
  if (!engine || !configuration) return;
  const config = configuration;
  const key = config.source.kind === 'hips' ? 'hips' : config.source.url;
  if (key === layerKey) {
    configureSurveys();
    if (config.source.kind === 'fits')
      engine
        .getOverlayImageLayer('exposure')
        ?.setOptions({ colormap: config.mode === 'color' ? 'viridis' : 'native' });
    if (!loading) send({ type: 'sky:ready' });
    return;
  }
  layerKey = key;
  const requestRevision = ++revision;
  loading = true;
  host.dataset.ready = 'false';
  surveys = [];
  for (const id of ['spherex-A', 'spherex-B', 'exposure']) engine.removeImageLayer(id);
  try {
    if (config.source.kind === 'hips') {
      for (let index = 0; index < 2; index++) {
        const source = config.source;
        let loadedCallback: () => void;
        let rejectCallback: () => void;
        const loadedPromise = new Promise<void>((resolve, reject) => {
          loadedCallback = resolve;
          rejectCallback = () => reject(new Error('No se pudo leer el mosaico oficial de IRSA.'));
        });
        const layer = A.HiPS(`spherex-${index}`, {
          url: source.url,
          name: source.title,
          successCallback: (loaded) => {
            if (requestRevision !== revision) return;
            surveys[index] = loaded;
            configureSurveys();
            loadedCallback();
          },
          errorCallback: () => rejectCallback(),
        });
        await layer.query;
        if (requestRevision !== revision) return;
        // Aladin shares a single spectral cursor for equal creator_did values.
        // Give each runtime view a unique cache key after parsing official properties.
        // The remote dataset and all its coordinates remain unchanged.
        layer.creatorDid = `${layer.creatorDid}#spherex-channel-${index}`;
        engine.setOverlayImageLayer(layer, index === 0 ? 'spherex-A' : 'spherex-B');
        await loadedPromise;
      }
      configureSurveys();
    } else {
      const response = await fetch(config.source.url, { signal: AbortSignal.timeout(65000) });
      if (!response.ok) throw new Error('IRSA no pudo preparar el recorte.');
      const imageUrl = URL.createObjectURL(
        new Blob([displayFits(await response.arrayBuffer())], { type: 'application/fits' }),
      );
      await new Promise<void>((resolve, reject) => {
        const layer = A.image(imageUrl, {
          name: config.source.title,
          imgFormat: 'fits',
          stretch: 'asinh',
          colormap: config.mode === 'color' ? 'viridis' : 'native',
          successCallback: (ra, dec, fov) => {
            host.dataset.imageRa = String(ra);
            host.dataset.imageDec = String(dec);
            host.dataset.imageFov = String(fov);
            URL.revokeObjectURL(imageUrl);
            resolve();
          },
          errorCallback: () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('No se pudo cargar el FITS.'));
          },
        });
        engine!.setOverlayImageLayer(layer, 'exposure');
      });
      if (requestRevision !== revision) return;
    }
    if (requestRevision !== revision) return;
    loading = false;
    host.dataset.ready = 'true';
    host.dataset.source = config.source.kind;
    send({ type: 'sky:ready' });
  } catch (error) {
    if (requestRevision !== revision) return;
    loading = false;
    layerKey = '';
    console.error(error);
    send({
      type: 'sky:error',
      message: 'No se pudo cargar esta imagen de IRSA. Reintenta o selecciona otra exposición.',
    });
  }
}

function applyConfiguration() {
  if (!engine || !configuration) return;
  applying = true;
  const { view } = configuration;
  const [ra, dec] = engine.getRaDec();
  const current = { longitude: ra, latitude: dec, fov: engine.getFov()[0] };
  if (!sameView(current, view)) {
    engine.gotoRaDec(view.longitude, view.latitude);
    engine.setFoV(view.fov);
  }
  applying = false;
  publishView(false);
  void updateLayers();
}

async function start() {
  if (starting || !configuration) return;
  starting = true;
  try {
    const moduleUrl = '/vendor/aladin/aladin.js';
    A = ((await import(/* @vite-ignore */ moduleUrl)) as { default: AladinAPI }).default;
    await A.init;
    engine = A.aladin(host, {
      target: `${configuration.view.longitude} ${configuration.view.latitude}`,
      fov: configuration.view.fov,
      cooFrame: 'ICRS',
      projection: 'SIN',
      survey: [],
      log: false,
      backgroundColor: 'rgb(20, 20, 20)',
      showZoomControl: false,
      showLayersControl: false,
      showFullscreenControl: false,
      showSimbadPointerControl: false,
      showCooGridControl: false,
      showSettingsControl: false,
      showSelectionModeControl: false,
      showColorPickerControl: false,
      showShareControl: false,
      showStatusBar: false,
      showFrame: false,
      showFov: false,
      showCooLocation: false,
      showProjectionControl: false,
      showContextMenu: false,
      showReticle: false,
      showCatalog: false,
      showCooGrid: false,
      inertia: false,
      lockNorthUp: true,
    });
    engine.setFoVRange(VIEW_LIMITS.minFov, VIEW_LIMITS.maxFov);
    // Same-origin, read-only access to Aladin's actual SIN/FITS display projection.
    (window as SkyProjectionWindow).spherexProjection = {
      worldToPixel: (ra, dec) => engine?.world2pix(ra, dec),
      pixelToWorld: (x, y) => engine?.pix2world(x, y),
      getSize: () => engine!.getSize(),
      getView: () => {
        const [longitude, latitude] = engine!.getRaDec();
        return { longitude, latitude, fov: engine!.getFov()[0] };
      },
      subscribe: (listener) => {
        projectionListeners.add(listener);
        return () => {
          projectionListeners.delete(listener);
        };
      },
    };
    for (const event of ['positionChanged', 'zoomChanged', 'resizeChanged'])
      engine.on(event, () => publishView());
    applyConfiguration();
  } catch (error) {
    console.error(error);
    send({
      type: 'sky:error',
      message: 'No se pudo iniciar WebGL2. Activa la aceleración gráfica y comprueba tu conexión.',
    });
  }
}

window.addEventListener('message', (event: MessageEvent) => {
  if (
    event.source !== parent ||
    event.origin !== location.origin ||
    event.data?.type !== 'sky:configure'
  )
    return;
  const { source, view, mode, secondFrame, overlay } = event.data;
  if (!view || ![view.longitude, view.latitude, view.fov].every(Number.isFinite)) return;
  if (source?.kind === 'hips') {
    if (
      source.url !== 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube' ||
      !Number.isInteger(source.frame) ||
      source.frame < 0 ||
      source.frame > 101 ||
      [50, 51].includes(source.frame) ||
      !Number.isInteger(secondFrame) ||
      secondFrame < 0 ||
      secondFrame > 101 ||
      [50, 51].includes(secondFrame)
    )
      return;
  } else if (
    source?.kind !== 'fits' ||
    typeof source.url !== 'string' ||
    !source.url.startsWith('/api/cutout?')
  )
    return;
  configuration = {
    source,
    view: normalizeView(view),
    mode: mode === 'color' ? 'color' : 'mono',
    secondFrame,
    overlay: Boolean(overlay),
  };
  if (engine) applyConfiguration();
  else void start();
});

host.addEventListener('keydown', (event) => {
  if (!engine) return;
  const [longitude, latitude] = engine.getRaDec();
  const fov = engine.getFov()[0];
  const next = { longitude, latitude, fov };
  const step = fov * 0.08;
  switch (event.key) {
    case 'ArrowLeft':
      next.longitude += step / Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
      break;
    case 'ArrowRight':
      next.longitude -= step / Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
      break;
    case 'ArrowUp':
      next.latitude += step;
      break;
    case 'ArrowDown':
      next.latitude -= step;
      break;
    case '+':
    case '=':
      next.fov /= 1.3;
      break;
    case '-':
    case '−':
      next.fov *= 1.3;
      break;
    case 'Home':
      Object.assign(next, DEFAULT_VIEW);
      break;
    case 'Escape':
      send({ type: 'sky:escape' });
      return;
    default:
      return;
  }
  event.preventDefault();
  applying = true;
  const safe = normalizeView(next);
  engine.gotoRaDec(safe.longitude, safe.latitude);
  engine.setFoV(safe.fov);
  applying = false;
  publishView();
});
host.addEventListener('pointerdown', () => host.focus({ preventScroll: true }));

// Upstream disables its two-finger gesture when lockNorthUp is true.
// Keep astronomical north fixed and apply only pinch scale through the public API.
let pinch: { distance: number; fov: number } | undefined;
const touchDistance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
host.addEventListener(
  'touchstart',
  (event) => {
    if (!engine || event.touches.length < 2) return;
    pinch = { distance: touchDistance(event.touches), fov: engine.getFov()[0] };
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  { capture: true, passive: false },
);
host.addEventListener(
  'touchmove',
  (event) => {
    if (!engine || !pinch) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.touches.length < 2) return;
    const distance = touchDistance(event.touches);
    if (distance < 1) return;
    const next =
      (2 * Math.atan((Math.tan((pinch.fov * Math.PI) / 360) * pinch.distance) / distance) * 180) /
      Math.PI;
    engine.setFoV(Math.max(VIEW_LIMITS.minFov, Math.min(VIEW_LIMITS.maxFov, next)));
    publishView();
  },
  { capture: true, passive: false },
);
for (const eventName of ['touchend', 'touchcancel'] as const)
  host.addEventListener(
    eventName,
    (event) => {
      if (!pinch) return;
      if (event.touches.length === 0) pinch = undefined;
      else {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, passive: false },
  );
send({ type: 'sky:boot' });
