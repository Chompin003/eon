import type { ViewState } from './contracts';

/** Read-only projection bridge. Annotations cannot mutate surveys, FITS or navigation. */
export interface SkyProjection {
  worldToPixel(ra: number, dec: number): [number, number] | undefined;
  pixelToWorld(x: number, y: number): [number, number] | undefined;
  getSize(): [number, number];
  getView(): ViewState;
  subscribe(listener: () => void): () => void;
}

export interface SkyProjectionWindow extends Window {
  spherexProjection?: SkyProjection;
}
