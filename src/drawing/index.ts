import type { SkyAnnotation } from '../shared';
export { PaintTools, PaintSurface, usePaintSession } from './Paint';

/** Empty module boundary for the drawing branch; tools intentionally deferred. */
export const initialAnnotations: readonly SkyAnnotation[] = Object.freeze([]);
