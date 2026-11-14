import { VIEW_LIMITS } from './contracts';

const radians = Math.PI / 180;
const wideScale = Math.tan((VIEW_LIMITS.maxFov * radians) / 2);
const narrowScale = Math.tan((VIEW_LIMITS.minFov * radians) / 2);
const logRange = Math.log(wideScale / narrowScale);

/** Logarithmic optical scale; equal slider movements have equal zoom ratios. */
export function zoomPositionToFov(position: number): number {
  const fraction = Math.min(1000, Math.max(0, position)) / 1000;
  return (2 * Math.atan(wideScale * Math.exp(-fraction * logRange))) / radians;
}

export function fovToZoomPosition(fov: number): number {
  const clamped = Math.max(VIEW_LIMITS.minFov, Math.min(VIEW_LIMITS.maxFov, fov));
  return (Math.log(wideScale / Math.tan((clamped * radians) / 2)) / logRange) * 1000;
}

export function opticalZoom(fov: number): number {
  return wideScale / Math.tan((fov * radians) / 2);
}
