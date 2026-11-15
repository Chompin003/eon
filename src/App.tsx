import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoordinatesPanel, ObservationsPanel, loadSurveyMetadata, spherexSource } from './data';
import {
  DEFAULT_VIEW,
  normalizeView,
  type DisplayMode,
  type FITSSource,
  type SurveyMetadata,
  type ViewState,
} from './shared';
import { SkyViewer } from './viewer';
import { ExplorerLayout } from './ui';
import { PaintTools, PaintSurface, usePaintSession } from './drawing';

export function App() {
  const paint = usePaintSession();
  const [view, setView] = useState<ViewState>({ ...DEFAULT_VIEW });
  const [metadata, setMetadata] = useState<SurveyMetadata>();
  const [dataError, setDataError] = useState('');
  const [dataAttempt, setDataAttempt] = useState(0);
  const [spectralFrame, setSpectralFrame] = useState(spherexSource.frame);
  const [secondFrame, setSecondFrame] = useState(84);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('mono');
  const [overlay, setOverlay] = useState(false);
  const [observationSource, setObservationSource] = useState<FITSSource | null>(null);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadSurveyMetadata(controller.signal)
      .then(setMetadata)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setDataError(error instanceof Error ? error.message : 'No se pudo consultar IRSA.');
      });
    return () => controller.abort();
  }, [dataAttempt]);

  const updateView = useCallback(
    (next: ViewState) =>
      setView((current) => {
        const safe = normalizeView(next);
        return Math.abs(current.longitude - safe.longitude) < 1e-9 &&
          Math.abs(current.latitude - safe.latitude) < 1e-9 &&
          Math.abs(current.fov - safe.fov) < 1e-10
          ? current
          : safe;
      }),
    [],
  );
  const source = useMemo(
    () => observationSource ?? { ...spherexSource, frame: spectralFrame },
    [observationSource, spectralFrame],
  );

  return (
    <ExplorerLayout
      view={view}
      onViewChange={updateView}
      onReset={() =>
        setView(
          observationSource ? { ...observationSource.center, fov: 0.08 } : { ...DEFAULT_VIEW },
        )
      }
      observationDate={observationSource?.dateUtc}
      metadata={metadata}
      spectralFrame={spectralFrame}
      onSpectralFrameChange={setSpectralFrame}
      secondFrame={secondFrame}
      onSecondFrameChange={setSecondFrame}
      displayMode={displayMode}
      onDisplayModeChange={setDisplayMode}
      overlay={overlay}
      onOverlayChange={setOverlay}
      showingObservation={Boolean(observationSource)}
      timeTools={
        <ObservationsPanel
          view={view}
          onViewChange={updateView}
          onSourceChange={setObservationSource}
          imageReady={imageReady}
        />
      }
      coordinateTools={<CoordinatesPanel view={view} onViewChange={updateView} />}
      drawingTools={<PaintTools session={paint} />}
    >
      {metadata ? (
        <SkyViewer
          source={source}
          secondFrame={secondFrame}
          mode={displayMode}
          overlay={overlay}
          onReadyChange={setImageReady}
          view={view}
          layers={CHECKERBOARD_LAYERS}
          onViewChange={updateView}
          renderAnnotations={(projection) => (
            <PaintSurface session={paint} projection={projection} />
          )}
        />
      ) : dataError ? (
        <div className="viewer-error" role="alert">
          <strong>No se pudo consultar SPHEREx</strong>
          <p>{dataError}</p>
          <button
            className="plain-button"
            onClick={() => {
              setDataError('');
              setDataAttempt(dataAttempt + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="viewer-loading" role="status">
          Consultando el mosaico oficial de SPHEREx…
        </div>
      )}
    </ExplorerLayout>
  );
}

const CHECKERBOARD_LAYERS = Object.freeze({ grid: false, stars: false });
