import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CoordinatesPanel,
  ObservationsPanel,
  TelescopeComparison,
  StudyPanel,
  StudyMarkers,
  DetectionMarkers,
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
  type PixelStudy,
  type ExportLayers,
  exportFilename,
  validRegionSize,
  regionWithMode,
  formatAngularSize,
} from './shared';
import {
  ArchiveRegions,
  AngularScale,
  SkyViewer,
  analyzePixels,
  captureSky,
  pngBlob,
  waitForExportFrame,
  createGifEncoder,
} from './viewer';
import { ExplorerLayout, ExportPanel, type ExportRequest } from './ui';
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
  const [restoreState, setRestoreState] = useState<'none' | 'loading' | 'ready' | 'error'>(
    initial?.exposure ? 'loading' : 'none',
  );
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [exampleRequest, setExampleRequest] = useState(0);
  const [study, setStudy] = useState<RegionStudy>();
  const [showStudy, setShowStudy] = useState(true);
  const [selectedObject, setSelectedObject] = useState<StudyObject>();
  const [pixelStudy, setPixelStudy] = useState<PixelStudy>();
  const [selectedTrack, setSelectedTrack] = useState<string>();
  const [showPixels, setShowPixels] = useState(true);
  const [frameRequest, setFrameRequest] = useState<{ id: string; nonce: number }>();
  const [timelineInterval, setTimelineInterval] = useState(200);
  const [exportLayers, setExportLayers] = useState<ExportLayers>();
  const requestFrame = (id: string) =>
    setFrameRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }));
  const paint = usePaintSession();
  const [comparisonSource, setComparisonSource] = useState<ArchiveHiPSSource | undefined>(() => {
    const source = ARCHIVE_SURVEYS.find((s) => s.id === initial?.telescope);
    return source?.provider === 'HLA' && initial?.hubble
      ? {
          ...source,
          dataset: initial.hubble.dataset,
          target: {
            longitude: initial.hubble.longitude,
            latitude: initial.hubble.latitude,
            fov: 0.015,
          },
        }
      : source;
  });
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
        validRegionSize(saved.sizeDeg, saved.extended === true)
      )
        return regionWithMode(saved, saved.extended === true);
    } catch {
      /* Storage is optional. */
    }
    return undefined;
  });
  const [extendedRegions, setExtendedRegions] = useState(Boolean(region?.extended));
  const updateRegionMode = (enabled: boolean) => {
    setExtendedRegions(enabled);
    if (!enabled) setRegion((current) => (current && current.sizeDeg > 0.25 ? undefined : current));
  };
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
  useEffect(() => {
    setPixelStudy(undefined);
    setSelectedTrack(undefined);
  }, [observationSource?.sequence?.id]);
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
  const exportFrames = useMemo(() => {
    const sequence = observationSource?.sequence;
    if (!sequence?.region || bufferStatus.sequenceId !== sequence.id) return [];
    const ready = new Set(bufferStatus.readyFrameIds);
    return sequence.frames
      .filter((f) => ready.has(f.id))
      .sort((a, b) => Date.parse(a.dateUtc) - Date.parse(b.dateUtc));
  }, [observationSource?.sequence, bufferStatus]);
  const exportView = async ({ format, layers, maxSide, signal, progress }: ExportRequest) => {
    // Snapshot the selection. Frame requests pause playback and preserve the sequence buffer.
    const original = observationSource;
    const frozenView = { ...view };
    if (format === 'gif' && exportFrames.length < 2)
      throw Error('Prepara al menos dos fechas de una región.');
    if (format === 'gif' && exportFrames.length > 200)
      throw Error('El GIF admite hasta 200 fechas. Reduce el rango temporal antes de exportar.');
    const frames = [...exportFrames];
    let encoder: ReturnType<(typeof import('./viewer'))['createGifEncoder']> | undefined;
    setExportLayers(layers);
    if (original) requestFrame(original.id);
    try {
      const root = document.querySelector<HTMLElement>('.viewer-surface');
      if (!root) throw Error('No se encontró el visor.');
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      signal.throwIfAborted();
      let blob: Blob, filename: string;
      if (format === 'png') {
        if (original?.sequence?.region) await waitForExportFrame(root, original.id, signal);
        const canvas = await captureSky(root, layers, signal, { maxSide });
        try {
          blob = await pngBlob(canvas);
        } finally {
          canvas.width = canvas.height = 0;
        }
        filename = exportFilename(frozenView);
      } else {
        encoder = createGifEncoder(signal);
        let dimensions = '';
        for (let i = 0; i < frames.length; i++) {
          signal.throwIfAborted();
          const frame = frames[i];
          progress(`Cuadro ${i + 1} de ${frames.length} · ${frame.dateUtc.slice(0, 10)}`);
          requestFrame(frame.id);
          await waitForExportFrame(root, frame.id, signal);
          const canvas = await captureSky(root, { ...layers, space: true }, signal, {
            maxSide,
            opaque: true,
            date: frame.dateUtc,
          });
          try {
            const currentDimensions = `${canvas.width}x${canvas.height}`;
            if (dimensions && dimensions !== currentDimensions)
              throw Error(
                'La ventana cambió de tamaño durante la exportación. Vuelve a intentarlo.',
              );
            dimensions = currentDimensions;
            await encoder.write(canvas, timelineInterval);
          } finally {
            canvas.width = canvas.height = 0;
          }
        }
        progress('Terminando el archivo…');
        blob = await encoder.finish();
        filename = exportFilename(frozenView, [frames[0].dateUtc, frames.at(-1)!.dateUtc]);
      }
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return filename;
    } finally {
      encoder?.dispose();
      setExportLayers(undefined);
      if (original) requestFrame(original.id);
    }
  };
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
    dataset: observationSource?.dataset ?? (restoring ? initial?.dataset : undefined),
    view,
    band: spectralFrame,
    band2: secondFrame,
    display: displayMode,
    spectralOverlay: overlay,
    telescope: comparisonSource?.id,
    hubble:
      comparisonSource?.provider === 'HLA'
        ? {
            dataset: comparisonSource.dataset!,
            longitude: comparisonSource.target!.longitude,
            latitude: comparisonSource.target!.latitude,
          }
        : undefined,
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
      selectingRegion={selectingRegion}
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
          onOpenExample={() => {
            setRestoreState('none');
            setRestoring(false);
            setComparisonSource(undefined);
            setExampleRequest((n) => n + 1);
          }}
          imageSource={observationSource ?? undefined}
          analyzePixels={analyzePixels}
          pixelStudy={pixelStudy}
          onPixelStudy={setPixelStudy}
          selectedTrack={selectedTrack}
          onTrackSelected={setSelectedTrack}
          showPixels={showPixels}
          onShowPixels={setShowPixels}
          onFrame={requestFrame}
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
      exportTools={
        <ExportPanel
          onExport={exportView}
          readyFrames={exportFrames.length}
          totalFrames={
            observationSource?.sequence?.region ? observationSource.sequence.frames.length : 0
          }
          markersAvailable={Boolean(pixelStudy || study)}
        />
      }
      timeTools={
        <ObservationsPanel
          extendedRegions={extendedRegions}
          onExtendedRegionsChange={updateRegionMode}
          onIntervalChange={setTimelineInterval}
          exampleRequest={exampleRequest}
          restoreExample={initial?.dataset === 'ngc1491-example'}
          frameRequest={frameRequest}
          restoreExposure={
            restoreState === 'loading' || restoreState === 'error' ? initial?.exposure : undefined
          }
          restoreAttempt={restoreAttempt}
          onRestoreStatus={(state, message) => {
            setRestoreState(state);
            setRestoreError(message ?? '');
          }}
          onRestoreSuccess={() => setRestoring(false)}
          view={view}
          onViewChange={updateView}
          onSourceChange={setObservationSource}
          imageReadiness={imageReadiness}
          bufferStatus={bufferStatus}
          selectedRegion={region}
          onSelectRegion={() => {
            setRestoreState('none');
            setRestoring(false);
            selectionPreviousView.current = view;
            setSelectingRegion(true);
            setView((current) => ({ ...current, fov: extendedRegions ? 2.5 : 0.5 }));
          }}
          onClearRegion={() => {
            setRegion(undefined);
            setRestoreState('none');
            setRestoring(false);
          }}
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
            setRestoreState('none');
            setRestoring(false);
            setObservationSource(null);
            updateView(next);
          }}
        />
      }
    >
      <>
        {!selectingRegion &&
          observationSource?.sequence?.region?.extended &&
          bufferStatus.failed === 0 && (
            <div className="sky-notice" role="status">
              <strong>
                Región ampliada · {formatAngularSize(observationSource.sequence.region.sizeDeg)} de
                lado
              </strong>
              <span>
                La preparación puede tardar más. Las zonas sin cobertura permanecen vacías.
              </span>
            </div>
          )}
        {observationSource?.sequence &&
          bufferStatus.sequenceId === observationSource.sequence.id &&
          bufferStatus.failed > 0 && (
            <div className="sky-notice sky-notice-error" role="alert">
              <strong>
                Animación incompleta · {bufferStatus.ready} de {bufferStatus.total} fechas
                preparadas
              </strong>
              <details>
                <summary>Ver motivo</summary>
                {bufferStatus.errorMessage ??
                  'Algunas fechas aún no se pudieron preparar. Revisa Tiempo para reintentar.'}
              </details>
            </div>
          )}
        {(restoreState === 'loading' || restoreState === 'error') && (
          <div className="link-restore-notice" role={restoreState === 'error' ? 'alert' : 'status'}>
            <strong>
              {restoreState === 'loading'
                ? 'Restaurando exposición del enlace…'
                : 'No se pudo restaurar la exposición del enlace.'}
            </strong>
            <p>
              {restoreState === 'loading'
                ? 'Consultando la fecha solicitada en IRSA.'
                : restoreError}
            </p>
            {restoreState === 'error' && (
              <button className="plain-button" onClick={() => setRestoreAttempt((n) => n + 1)}>
                Reintentar enlace
              </button>
            )}{' '}
            <button
              className="plain-button"
              onClick={() => {
                setRestoreState('none');
                setRestoring(false);
              }}
            >
              Ver mosaico
            </button>
          </div>
        )}
        {metadata || observationSource?.sequence?.region ? (
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
            extendedRegions={extendedRegions}
            onExtendedRegionsChange={updateRegionMode}
            onRegionSelected={(value) => {
              setRegion(value);
              if (value.extended) setExtendedRegions(true);
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
                <AngularScale projection={projection} />
                <ArchiveRegions
                  projection={projection}
                  source={comparisonSource}
                  onOpen={(field) => {
                    setComparisonSource(field);
                    setObservationSource(null);
                    setRestoreState('none');
                    setRestoring(false);
                    updateView(field.target!);
                  }}
                />
                {pixelStudy && (exportLayers?.markers ?? showPixels) && observationSource && (
                  <DetectionMarkers
                    result={pixelStudy}
                    frameId={observationSource.id}
                    projection={projection}
                    selected={selectedTrack}
                    onSelect={setSelectedTrack}
                  />
                )}
                {study && (showStudy || (exportLayers?.markers && !pixelStudy)) && (
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
      </>
    </ExplorerLayout>
  );
}

const CHECKERBOARD_LAYERS = Object.freeze({ grid: false, stars: false });
