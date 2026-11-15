import type { SkyProjection } from '../shared';

export interface PaintController extends HTMLElement {
  attachSurface(board: SVGSVGElement, projection: SkyProjection): () => void;
}
export function createPaintController(): PaintController;
