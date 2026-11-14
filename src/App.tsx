import { useState } from 'react';
import { demoSource } from './data';
import { DEFAULT_VIEW, normalizeView, type ViewerLayers, type ViewState } from './shared';
import { SkyViewer } from './viewer';
import { ExplorerLayout } from './ui';

export function App() {
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [layers, setLayers] = useState<ViewerLayers>({ grid: true, stars: true });

  return (
    <ExplorerLayout
      source={demoSource}
      view={view}
      layers={layers}
      onLayersChange={setLayers}
      onViewChange={(next) => setView(normalizeView(next))}
      onReset={() => setView({ ...DEFAULT_VIEW })}
    >
      <SkyViewer source={demoSource} view={view} layers={layers} onViewChange={setView} />
    </ExplorerLayout>
  );
}
