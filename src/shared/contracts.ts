/** Equatorial ICRS degrees. RA increases eastward; fov is horizontal, in degrees. */
export interface ViewState {
  longitude: number;
  latitude: number;
  fov: number;
}

export interface ViewerLayers {
  grid: boolean;
  stars: boolean;
}

/** Future providers add a new discriminated variant here, coordinated by the team. */
export interface CheckerboardSource {
  kind: 'checkerboard';
  id: string;
  title: string;
  description: string;
  columns: number;
  rows: number;
}

export interface HiPSSource {
  kind: 'hips';
  id: string;
  title: string;
  url: string;
  /** Zero-based spectral layer, NOT an observation epoch. */
  frame: number;
}

export interface FITSSource {
  kind: 'fits';
  id: string;
  title: string;
  dateUtc: string;
  center: Readonly<Pick<ViewState, 'longitude' | 'latitude'>>;
  /** Same-origin cutout endpoint. It serves only the calibrated IMAGE HDU. */
  url: string;
}

/** Archive previews contain heterogeneous filters and partial sky coverage, not a spectrum. */
export interface ArchiveHiPSSource {
  kind: 'archive-hips';
  id: string;
  title: string;
  telescope: 'Hubble' | 'Webb';
  url: string;
  instrument: string;
  releaseDate: string;
}

export type DisplayMode = 'mono' | 'color' | 'split';

export interface Observation {
  id: string;
  dateUtc: string;
  mjd: number;
  detector: string;
  url: string;
  collection: string;
}

export interface SurveyMetadata {
  title: string;
  releaseDate: string;
  pixelScaleArcsec: number;
  observationStart: string;
  observationEnd: string;
  channels: readonly { frame: number; wavelengthUm: number }[];
}

export type SkySource = CheckerboardSource | HiPSSource | FITSSource | ArchiveHiPSSource;

/** Reserved data-only contract; no drawing UI or science data implemented yet. */
export interface SkyAnnotation {
  id: string;
  longitude: number;
  latitude: number;
  label: string;
}

/** Horizontal FOV. Zoom below native sampling magnifies existing pixels. */
export const VIEW_LIMITS = { minFov: 1 / 3600, maxFov: 100, maxLatitude: 90 } as const;
export const DEFAULT_VIEW: Readonly<ViewState> = Object.freeze({
  longitude: 60.8109955,
  latitude: 51.3404038,
  fov: 10,
});

export function normalizeView(view: ViewState): ViewState {
  const safe = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  return {
    longitude: wrapRa(safe(view.longitude, DEFAULT_VIEW.longitude)),
    latitude: Math.max(
      -VIEW_LIMITS.maxLatitude,
      Math.min(VIEW_LIMITS.maxLatitude, safe(view.latitude, DEFAULT_VIEW.latitude)),
    ),
    fov: Math.max(
      VIEW_LIMITS.minFov,
      Math.min(VIEW_LIMITS.maxFov, safe(view.fov, DEFAULT_VIEW.fov)),
    ),
  };
}

function wrapRa(value: number): number {
  if (value >= 0 && value < 360) return value;
  return ((value % 360) + 360) % 360;
}
