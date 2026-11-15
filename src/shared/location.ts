import {
  DEFAULT_VIEW,
  VIEW_LIMITS,
  type DisplayMode,
  type SkyRegion,
  type ViewState,
} from './contracts';
import { ARCHIVE_SURVEYS } from './archiveSurveys';

export interface SharedExposure {
  id: string;
  region: SkyRegion;
}
export interface SharedLocation {
  view: ViewState;
  band: number;
  band2: number;
  display: DisplayMode;
  spectralOverlay: boolean;
  telescope?: string;
  comparison: 'split' | 'overlay';
  transparency: number;
  region?: SkyRegion;
  exposure?: SharedExposure;
}
export function readLocation(url: URL): SharedLocation | undefined {
  const q = url.searchParams;
  const number = (key: string, min: number, max: number) => {
    const raw = q.get(key);
    if (!raw?.trim()) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
  };
  const ra = number('ra', 0, 360),
    dec = number('dec', -90, 90);
  if (ra === undefined || dec === undefined) return undefined;
  const size = number('size', 0.02, 0.25),
    cx = number('cx', 0, 360) ?? ra,
    cy = number('cy', -90, 90) ?? dec;
  const region =
    size === undefined ? undefined : { longitude: cx % 360, latitude: cy, sizeDeg: size };
  const epoch = q.get('epoch');
  const band = number('band', 0, 101),
    band2 = number('band2', 0, 101);
  return {
    view: {
      longitude: ra % 360,
      latitude: dec,
      fov: number('fov', VIEW_LIMITS.minFov, VIEW_LIMITS.maxFov) ?? DEFAULT_VIEW.fov,
    },
    band: band !== undefined && Number.isInteger(band) && ![50, 51].includes(band) ? band : 62,
    band2: band2 !== undefined && Number.isInteger(band2) && ![50, 51].includes(band2) ? band2 : 84,
    display:
      q.get('display') === 'color' ? 'color' : q.get('display') === 'split' ? 'split' : 'mono',
    spectralOverlay: q.get('mix') === '1',
    telescope: ARCHIVE_SURVEYS.find((s) => s.id === q.get('tel'))?.id,
    comparison: q.get('compare') === 'split' ? 'split' : 'overlay',
    transparency: number('fade', 0, 100) ?? 35,
    region,
    exposure:
      region && epoch && /^[\w-]{1,100}:SPHEREx-D[1-6]$/.test(epoch)
        ? { id: epoch, region }
        : undefined,
  };
}
const owned = [
  'ra',
  'dec',
  'fov',
  'band',
  'band2',
  'display',
  'mix',
  'tel',
  'compare',
  'fade',
  'size',
  'cx',
  'cy',
  'epoch',
];
export function writeLocation(input: URL, state: SharedLocation): URL {
  const url = new URL(input),
    q = url.searchParams;
  for (const key of owned) q.delete(key);
  const put = (key: string, value: number) => q.set(key, String(Number(value.toFixed(9))));
  put('ra', state.view.longitude);
  put('dec', state.view.latitude);
  put('fov', state.view.fov);
  if (state.band !== 62) put('band', state.band);
  if (state.band2 !== 84) put('band2', state.band2);
  if (state.display !== 'mono') q.set('display', state.display);
  if (state.spectralOverlay) q.set('mix', '1');
  if (state.telescope) {
    q.set('tel', state.telescope);
    q.set('compare', state.comparison);
    put('fade', state.transparency);
  }
  const region = state.exposure?.region ?? state.region;
  if (region) {
    put('size', region.sizeDeg);
    put('cx', region.longitude);
    put('cy', region.latitude);
  }
  if (state.exposure) q.set('epoch', state.exposure.id);
  return url;
}
