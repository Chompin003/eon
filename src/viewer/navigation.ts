import { normalizeView, type ViewState } from '../shared';

export function panView(
  view: ViewState,
  deltaX: number,
  deltaY: number,
  viewportHeight: number,
): ViewState {
  const degreesPerPixel = view.fov / Math.max(1, viewportHeight);
  return normalizeView({
    ...view,
    longitude: view.longitude - deltaX * degreesPerPixel,
    latitude: view.latitude + deltaY * degreesPerPixel,
  });
}

export function zoomView(view: ViewState, factor: number): ViewState {
  const radians = Math.PI / 180;
  const fov = (2 * Math.atan(Math.tan((view.fov * radians) / 2) * factor)) / radians;
  return normalizeView({ ...view, fov });
}

/** Scale line/page-mode wheel devices into approximately equivalent pixel deltas. */
export function wheelZoomFactor(deltaY: number, deltaMode: number, height: number): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
  return Math.exp(Math.max(-500, Math.min(500, pixels)) * 0.0015);
}
