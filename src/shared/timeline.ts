/** Actual observation dates will be supplied by data/. Demo dates are not coverage. */
export interface ObservationEpoch {
  id: string;
  dateUtc: string;
}

export interface TimelineState {
  epochIndex: number;
  intervalMs: number;
  playing: boolean;
}

export const TIMELINE_LIMITS = { minIntervalMs: 100, maxIntervalMs: 2000 } as const;
