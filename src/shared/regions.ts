import type { SkyRegion } from './contracts';
export const REGION_LIMITS = {
  min: 0.02,
  normalMax: 0.25,
  extendedMax: 1,
  normalCutoutMax: 0.4,
  extendedCutoutMax: 1.5,
  analysisPixels: 2097152,
} as const;
export function validRegionSize(size: number, extended = false): boolean {
  return (
    Number.isFinite(size) &&
    size >= REGION_LIMITS.min &&
    size <= (extended ? REGION_LIMITS.extendedMax : REGION_LIMITS.normalMax)
  );
}
export function regionWithMode(region: SkyRegion, extended: boolean): SkyRegion {
  return {
    longitude: region.longitude,
    latitude: region.latitude,
    sizeDeg: region.sizeDeg,
    ...(extended ? { extended: true } : {}),
  };
}
export function formatAngularSize(degrees: number): string {
  return degrees >= 1 / 60
    ? `${Number((degrees * 60).toFixed(1))}′`
    : `${Number((degrees * 3600).toFixed(1))}″`;
}
