import type { ObservationEpoch } from '../shared';

/** UI fixtures only: not SPHEREx observing dates or release coverage. */
export const demoEpochs: readonly ObservationEpoch[] = Object.freeze([
  { id: 'demo-0', dateUtc: '2025-07-01' },
  { id: 'demo-1', dateUtc: '2026-01-01' },
  { id: 'demo-2', dateUtc: '2026-07-01' },
  { id: 'demo-3', dateUtc: '2027-01-01' },
]);
