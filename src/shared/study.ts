import type { SkyRegion } from './contracts';
export type ObjectClass = 'star' | 'galaxy' | 'quasar' | 'nebula' | 'cluster' | 'unknown';
export interface StudyObject {
  id: string;
  name: string;
  provider: 'Gaia DR3' | 'SIMBAD';
  longitude: number;
  latitude: number;
  referenceEpoch: number;
  pmra?: number;
  pmdec?: number;
  category: ObjectClass;
  description: string;
  probability?: number;
  probabilities?: { star?: number; galaxy?: number; quasar?: number };
}
export interface RegionStudy {
  region: SkyRegion;
  objects: readonly StudyObject[];
  errors: readonly string[];
  truncated: boolean;
  queriedAt: string;
}
const RAD = Math.PI / 180;
/** Linear tangent proper motion, not measured image tracking or perspective motion. */
export function objectPosition(object: StudyObject, year: number): [number, number] {
  if (object.pmra === undefined || object.pmdec === undefined)
    return [object.longitude, object.latitude];
  const ra = object.longitude * RAD,
    dec = object.latitude * RAD;
  const east = ((object.pmra ?? 0) * (year - object.referenceEpoch) * RAD) / 3600000;
  const north = ((object.pmdec ?? 0) * (year - object.referenceEpoch) * RAD) / 3600000;
  const x =
    Math.cos(dec) * Math.cos(ra) - east * Math.sin(ra) - north * Math.sin(dec) * Math.cos(ra);
  const y =
    Math.cos(dec) * Math.sin(ra) + east * Math.cos(ra) - north * Math.sin(dec) * Math.sin(ra);
  const z = Math.sin(dec) + north * Math.cos(dec);
  return [(((Math.atan2(y, x) / RAD) % 360) + 360) % 360, Math.atan2(z, Math.hypot(x, y)) / RAD];
}
export function inStudyRegion(ra: number, dec: number, region: SkyRegion): boolean {
  const a = (ra - region.longitude) * RAD,
    d = dec * RAD,
    c = region.latitude * RAD;
  const depth = Math.sin(d) * Math.sin(c) + Math.cos(d) * Math.cos(c) * Math.cos(a);
  if (depth <= 0) return false;
  const x = (Math.cos(d) * Math.sin(a)) / depth;
  const y = (Math.sin(d) * Math.cos(c) - Math.cos(d) * Math.sin(c) * Math.cos(a)) / depth;
  const half = Math.tan((region.sizeDeg * RAD) / 2);
  return Math.abs(x) <= half && Math.abs(y) <= half;
}
export function observationYear(date?: string): number {
  const epoch = date ? Date.parse(date) : Date.now();
  return 2000 + (epoch - Date.UTC(2000, 0, 1, 12)) / 31557600000;
}
export const OBJECT_STYLES: Record<ObjectClass, { label: string; color: string }> = {
  star: { label: 'Estrella', color: '#67c1ff' },
  galaxy: { label: 'Galaxia', color: '#da97ff' },
  quasar: { label: 'Cuásar', color: '#ffbb68' },
  nebula: { label: 'Nebulosa / gas', color: '#74e3b1' },
  cluster: { label: 'Cúmulo', color: '#f3d976' },
  unknown: { label: 'Sin clasificar', color: '#c9c9c9' },
};
