import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BufferStatus, DisplayMode, FITSSource, SkyProjection, ViewState } from '../shared';
import { RegionBuffer } from './regionBuffer';
import { RegionCanvas } from './RegionCanvas';

interface Props {
  source: FITSSource;
  view: ViewState;
  mode: DisplayMode;
  comparisonPane?: ReactNode;
  comparisonTitle?: string;
  comparisonMode?: 'split' | 'overlay';
  transparency?: number;
  onViewChange: (view: ViewState) => void;
  onReadyChange?: (ready: boolean) => void;
  onBufferStatus?: (status: BufferStatus) => void;
  renderAnnotations?: (projection: SkyProjection) => ReactNode;
}
export function TimelapseViewer(props: Props) {
  const sequence = props.source.sequence!,
    region = sequence.region!;
  // Retry keeps the same object and every successful frame, including its display stretch.
  const buffer = useMemo(() => new RegionBuffer(sequence.frames, region), [sequence.id]);
  const [revision, setRevision] = useState(0);
  const current = useRef(props);
  current.current = props;
  useEffect(() => {
    const abort = new AbortController();
    const changed = () => setRevision((value) => value + 1);
    const unsubscribe = buffer.subscribe(changed);
    void buffer.load(abort.signal);
    return () => {
      abort.abort();
      unsubscribe();
    };
  }, [buffer, sequence.attempt]);
  useEffect(() => {
    current.current.onBufferStatus?.({ ...buffer.status(), sequenceId: sequence.id });
  }, [buffer, revision, sequence.id]);
  const split = props.mode === 'split',
    overlay = Boolean(props.comparisonPane) && props.comparisonMode === 'overlay',
    two = props.comparisonPane ? !overlay : split;
  const common = {
    region,
    buffer,
    frameId: props.source.id,
    view: props.view,
    revision,
    onViewChange: props.onViewChange,
    renderAnnotations: props.renderAnnotations,
  };
  return (
    <div className={two ? 'sky-split' : 'sky-single'} data-player="region-2d">
      <div className="sky-pane region-pane">
        <RegionCanvas
          {...common}
          comparisonOverlay={overlay ? props.comparisonPane : undefined}
          comparisonOpacity={1 - (props.transparency ?? 35) / 100}
          mode={split ? 'mono' : (props.mode as 'mono' | 'color')}
          onPresented={(ready) => current.current.onReadyChange?.(ready)}
        />
        {two && (
          <span className="pane-label">
            {props.comparisonPane ? 'SPHEREx · región' : 'Blanco y negro'}
          </span>
        )}
      </div>
      {two && (
        <div className={props.comparisonPane ? 'sky-pane' : 'sky-pane region-pane'}>
          {props.comparisonPane ?? <RegionCanvas {...common} mode="color" onPresented={() => {}} />}
          <span className="pane-label">{props.comparisonTitle ?? 'Pseudocolor'}</span>
        </div>
      )}
    </div>
  );
}
