/** Degrees in a synthetic right-ascension/declination frame (not calibrated data). */
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

export type SkySource = CheckerboardSource;

/** Reserved data-only contract; no drawing UI or science data implemented yet. */
export interface SkyAnnotation {
  id: string;
  longitude: number;
  latitude: number;
  label: string;
}

export const VIEW_LIMITS = { minFov: 25, maxFov: 100, maxLatitude: 85 } as const;
export const DEFAULT_VIEW: Readonly<ViewState> = Object.freeze({
  longitude: 180,
  latitude: 12,
  fov: 75,
});

export function normalizeView(view: ViewState): ViewState {
  const safe = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  return {
    longitude: ((safe(view.longitude, DEFAULT_VIEW.longitude) % 360) + 360) % 360,
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
