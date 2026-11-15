/// <reference lib="webworker" />
import {
  associateDetections,
  linkDetections,
  type PixelStudyRequest,
  type PixelStudy,
  type DetectedExposure,
} from '../shared';
import { detectFits, getSep } from './sep';
self.onmessage = async (event: MessageEvent<PixelStudyRequest>) => {
  const request = event.data,
    t = performance.now();
  try {
    if (!Number.isFinite(request.threshold) || request.threshold < 3 || request.threshold > 10)
      throw Error('Umbral de detección inválido.');
    await getSep();
    const selected = request.frames.slice(0, 96),
      active = request.frames.find((f) => f.id === request.activeFrameId);
    if (active && !selected.some((f) => f.id === active.id)) {
      selected.pop();
      selected.push(active);
    }
    selected.sort((a, b) => Date.parse(a.dateUtc) - Date.parse(b.dateUtc));
    const frames: DetectedExposure[] = [],
      failures: { frameId: string; message: string }[] = [];
    let networkFailures = 0;
    for (let i = 0; i < selected.length; i++) {
      const frame = selected[i];
      if (performance.now() - t > 180000 || networkFailures >= 3) {
        for (const pending of selected.slice(i))
          failures.push({
            frameId: pending.id,
            message: 'Análisis detenido por límite de tiempo o fallos consecutivos del archivo.',
          });
        break;
      }
      self.postMessage({
        type: 'progress',
        progress: {
          completed: i,
          total: selected.length,
          message: `Analizando exposición ${i + 1}/${selected.length}`,
        },
      });
      try {
        const url = new URL(frame.url, self.location.origin);
        if (
          url.origin !== self.location.origin ||
          (url.pathname !== '/api/cutout' &&
            !/^\/examples\/spherex\/epoch-[0-2]\.fits$/.test(url.pathname))
        )
          throw Error('Origen FITS no permitido.');
        let response: Response;
        try {
          response = await fetch(url, {
            cache: 'force-cache',
            signal: AbortSignal.timeout(
              Math.max(1, Math.min(35000, 180000 - (performance.now() - t))),
            ),
          });
        } catch (error) {
          networkFailures++;
          throw error;
        }
        if (!response.ok) {
          networkFailures++;
          throw Error(`No se pudo leer este FITS (${response.status}).`);
        }
        networkFailures = 0;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 12 * 1024 * 1024) throw Error('El FITS excede el límite.');
        const detected = await detectFits(
          bytes,
          request.region,
          frame.id,
          frame.dateUtc,
          request.threshold,
        );
        if (Math.abs(detected.mjd - (Date.parse(frame.dateUtc) / 86400000 + 40587)) * 86400 > 1)
          throw Error('La fecha del FITS no coincide con la exposición solicitada.');
        frames.push({ ...associateDetections(detected, request.catalog), inputUrl: frame.url });
      } catch (error) {
        failures.push({
          frameId: frame.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (!frames.length) throw Error(failures[0]?.message ?? 'No hay exposiciones para analizar.');
    const result: PixelStudy = {
      method: 'SEP 1.4.1',
      dataset: request.dataset,
      catalogQueriedAt: request.catalogQueriedAt,
      region: request.region,
      frames,
      tracks: linkDetections(
        frames,
        6.15,
        selected.map((f) => f.id),
      ),
      failures,
      omittedFrames: Math.max(0, request.frames.length - selected.length),
      parameters: {
        threshold: request.threshold,
        minArea: 5,
        associationRadiusArcsec: 6.15,
        trackingMarginArcsec: 1.5,
      },
      seconds: (performance.now() - t) / 1000,
    };
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
