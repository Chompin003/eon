import type { SkySource } from '../shared';

export { demoEpochs } from './demoEpochs';
export { CoordinatesPanel } from './coordinates/CoordinatesPanel';

/** Deterministic local source. Replace/extend via shared contracts, never in the UI. */
export const demoSource: SkySource = Object.freeze({
  kind: 'checkerboard',
  id: 'procedural-checkerboard-v1',
  title: 'Checkerboard',
  description: 'Textura procedural de referencia',
  columns: 24,
  rows: 12,
});
