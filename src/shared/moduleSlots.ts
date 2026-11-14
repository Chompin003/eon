import type { ViewState } from './contracts';

/** GorditoG's coordinate form receives this contract from App.tsx. */
export interface CoordinateToolsProps {
  view: Readonly<ViewState>;
  onViewChange: (next: ViewState) => void;
}
