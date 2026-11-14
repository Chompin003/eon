import { useEffect, useState } from 'react';
import { demoEpochs, demoSource } from './data';
import { DEFAULT_VIEW, normalizeView, type TimelineState, type ViewState } from './shared';
import { SkyViewer } from './viewer';
import { ExplorerLayout } from './ui';

export function App() {
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [timeline, setTimeline] = useState<TimelineState>({
    epochIndex: 0,
    intervalMs: 500,
    playing: false,
  });

  useEffect(() => {
    if (!timeline.playing || demoEpochs.length < 2) return;
    const timer = window.setInterval(() => {
      setTimeline((current) => ({
        ...current,
        epochIndex: (current.epochIndex + 1) % demoEpochs.length,
      }));
    }, timeline.intervalMs);
    return () => window.clearInterval(timer);
  }, [timeline.playing, timeline.intervalMs]);

  const updateView = (next: ViewState) => setView(normalizeView(next));

  // Iván / GorditoG: mount your component using coordinateTools below.
  // Example: coordinateTools={<CoordinatesPanel view={view} onViewChange={updateView} />}
  // Contract and steps: docs/INTEGRACION-COORDENADAS.md. No UI window changes required.
  return (
    <ExplorerLayout
      view={view}
      epochs={demoEpochs}
      timeline={timeline}
      onTimelineChange={setTimeline}
      onViewChange={updateView}
      onReset={() => setView({ ...DEFAULT_VIEW })}
    >
      <SkyViewer
        source={demoSource}
        view={view}
        layers={CHECKERBOARD_LAYERS}
        onViewChange={setView}
      />
    </ExplorerLayout>
  );
}

const CHECKERBOARD_LAYERS = Object.freeze({ grid: false, stars: false });
