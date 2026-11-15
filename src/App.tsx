import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CoordinatesPanel,
  ObservationsPanel,
  TelescopeComparison,
  StudyPanel,
  StudyMarkers,
  loadSurveyMetadata,
  spherexSource,
} from './data';
import {
  DEFAULT_VIEW,
  normalizeView,
  createImageReadiness,
  type DisplayMode,
  type FITSSource,
  type SurveyMetadata,
  type ViewState,
  type BufferStatus,
  type ArchiveHiPSSource,
  type SkyRegion,
  readLocation,
  ARCHIVE_SURVEYS,
  type RegionStudy,
  type StudyObject,
} from './shared';
import { SkyViewer } from './viewer';
import { ExplorerLayout } from './ui';
import { PaintTools, PaintSurface, usePaintSession } from './drawing';
import { useShareLink } from './useShareLink';

export function App() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const pop = () => setRevision((n) => n + 1);
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  return <ExplorerApp key={revision} />;
}
function ExplorerApp() {
  const [initial] = useState(() => readLocation(new URL(location.href)));
  const [restoring, setRestoring] = useState(Boolean(initial?.exposure));
  const [study, setStudy] = useState<RegionStudy>();
  const [showStudy, setShowStudy] = useState(true);
  const [selectedObject, setSelectedObject] = useState<StudyObject>();
  const paint = usePaintSession();
  const [comparisonSource, setComparisonSource] = useState<ArchiveHiPSSource | undefined>(() =>
    ARCHIVE_SURVEYS.find((s) => s.id === initial?.telescope),
  );
  const [region, setRegion] = useState<SkyRegion | undefined>(() => {
    if (initial) return initial.region;
    try {
      const saved = JSON.parse(localStorage.getItem('eon:last-region:v1') ?? 'null');
      if (
        saved &&
        [saved.longitude, saved.latitude, saved.sizeDeg].every(Number.isFinite) &&
        saved.longitude >= 0 &&
        saved.longitude < 360 &&
        Math.abs(saved.latitude) <= 90 &&
        saved.sizeDeg >= 0.02 &&
        saved.sizeDeg <= 0.25
      )
        return { longitude: saved.longitude, latitude: saved.latitude, sizeDeg: saved.sizeDeg };
    } catch {
      /* Storage is optional. */
    }
    return undefined;
  });
  const [view, setView] = useState<ViewState>(
    initial?.view ??
      (region
        ? { longitude: region.longitude, latitude: region.latitude, fov: region.sizeDeg * 2.5 }
        : { ...DEFAULT_VIEW }),
  );
  const [metadata, setMetadata] = useState<SurveyMetadata>();
  const [dataError, setDataError] = useState('');
  const [dataAttempt, setDataAttempt] = useState(0);
  const [spectralFrame, setSpectralFrame] = useState(initial?.band ?? spherexSource.frame);
  const [secondFrame, setSecondFrame] = useState(initial?.band2 ?? 84);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initial?.display ?? 'mono');
  const [overlay, setOverlay] = useState(initial?.spectralOverlay ?? false);
  const [comparisonMode, setComparisonMode] = useState<'split' | 'overlay'>(
    initial?.comparison ?? 'overlay',
  );
  const [transparency, setTransparency] = useState(initial?.transparency ?? 35);
  const [observationSource, setObservationSource] = useState<FITSSource | null>(null);
  const [selectingRegion, setSelectingRegion] = useState(false);
  const selectionPreviousView = useRef(view);
  const [imageReadiness] = useState(createImageReadiness);
  const [bufferStatus, setBufferStatus] = useState<BufferStatus>({
    total: 0,
    prepared: 0,
    ready: 0,
    failed: 0,
    bytes: 0,
  });
  useEffect(() => {
    try {
      if (region) localStorage.setItem('eon:last-region:v1', JSON.stringify(region));
      else localStorage.removeItem('eon:last-region:v1');
    } catch {
      /* Playback does not require persistent storage. */
    }
  }, [region]);

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
  const share = useShareLink({
    view,
    band: spectralFrame,
    band2: secondFrame,
    display: displayMode,
    spectralOverlay: overlay,
    telescope: comparisonSource?.id,
    comparison: comparisonMode,
    transparency,
    region,
    exposure: observationSource?.sequence?.region
      ? { id: observationSource.id, region: observationSource.sequence.region }
      : restoring
        ? initial?.exposure
        : undefined,
  });

  return (
    <ExplorerLayout
      view={view}
      onViewChange={updateView}
      onReset={() =>
        setView(
          observationSource
            ? {
                ...observationSource.center,
                fov: observationSource.sequence?.region?.sizeDeg ?? 0.08,
              }
            : { ...DEFAULT_VIEW },
        )
      }
      observationDate={observationSource?.dateUtc}
      metadata={metadata}
      spectralFrame={spectralFrame}
      onSpectralFrameChange={setSpectralFrame}
      secondFrame={secondFrame}
      onSecondFrameChange={setSecondFrame}
      displayMode={displayMode}
      onDisplayModeChange={(mode) => {
        setDisplayMode(mode);
        if (mode === 'split') setComparisonSource(undefined);
      }}
      overlay={overlay}
      onOverlayChange={setOverlay}
      showingObservation={Boolean(observationSource)}
      studyTools={
        <StudyPanel
          date={observationSource?.dateUtc}
          region={observationSource?.sequence?.region ?? region}
          view={view}
          onViewChange={updateView}
          result={study}
          visible={showStudy}
          onVisibleChange={setShowStudy}
          onResult={setStudy}
          selected={selectedObject}
          onSelected={setSelectedObject}
        />
      }
      shareTools={
        <div className="control-section">
          <button className="plain-button" onClick={() => void share.copy()}>
            {share.copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          {share.manual && (
            <input
              aria-label="Enlace para compartir"
              readOnly
              value={share.manual}
              onFocus={(e) => e.currentTarget.select()}
            />
          )}
        </div>
      }
      timeTools={
        <ObservationsPanel
          restoreExposure={initial?.exposure}
          onRestoreSettled={() => setRestoring(false)}
          view={view}
          onViewChange={updateView}
          onSourceChange={setObservationSource}
          imageReadiness={imageReadiness}
          bufferStatus={bufferStatus}
          selectedRegion={region}
          onSelectRegion={() => {
            selectionPreviousView.current = view;
            setSelectingRegion(true);
            setView((current) => ({ ...current, fov: 0.5 }));
          }}
          onClearRegion={() => setRegion(undefined)}
        />
      }
      coordinateTools={<CoordinatesPanel view={view} onViewChange={updateView} />}
      drawingTools={<PaintTools session={paint} />}
      telescopeTools={
        <TelescopeComparison
          mode={comparisonMode}
          onModeChange={setComparisonMode}
          transparency={transparency}
          onTransparencyChange={setTransparency}
          source={comparisonSource}
          onSourceChange={setComparisonSource}
          view={view}
          onViewChange={(next) => {
            setObservationSource(null);
            updateView(next);
          }}
        />
      }
    >
      {metadata ? (
        <SkyViewer
          source={source}
          comparisonSource={comparisonSource}
          comparisonMode={comparisonMode}
          transparency={transparency}
          secondFrame={secondFrame}
          mode={displayMode}
          overlay={overlay}
          onReadyChange={imageReadiness.setReady}
          onBufferStatus={setBufferStatus}
          selectingRegion={selectingRegion}
          onRegionSelected={(value) => {
            setRegion(value);
            setSelectingRegion(false);
            setView({
              longitude: value.longitude,
              latitude: value.latitude,
              fov: value.sizeDeg * 2.5,
            });
          }}
          onCancelRegion={() => {
            setSelectingRegion(false);
            setView(selectionPreviousView.current);
          }}
          view={view}
          layers={CHECKERBOARD_LAYERS}
          onViewChange={updateView}
          renderAnnotations={(projection) => (
            <>
              <PaintSurface session={paint} projection={projection} />
              {study && showStudy && (
                <StudyMarkers
                  result={study}
                  projection={projection}
                  date={observationSource?.dateUtc}
                  selected={selectedObject?.id}
                  onSelect={setSelectedObject}
                />
              )}
            </>
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
