import type { PixelStudy, PixelStudyRequest, PixelProgress } from '../shared';
export function analyzePixels(
  request: PixelStudyRequest,
  signal: AbortSignal,
  onProgress: (progress: PixelProgress) => void,
): Promise<PixelStudy> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Análisis cancelado.', 'AbortError'));
      return;
    }
    const worker = new Worker(new URL('./pixelWorker.ts', import.meta.url), { type: 'module' });
    const stop = () => {
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      stop();
      reject(new DOMException('Análisis cancelado.', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.onerror = () => {
      stop();
      reject(Error('Falló el trabajador de análisis. Inténtalo otra vez.'));
    };
    worker.onmessage = (
      event: MessageEvent<{
        type: string;
        result: PixelStudy;
        error: string;
        progress: PixelProgress;
      }>,
    ) => {
      if (event.data.type === 'progress') onProgress(event.data.progress);
      if (event.data.type === 'result') {
        stop();
        resolve(event.data.result);
      }
      if (event.data.type === 'error') {
        stop();
        reject(Error(event.data.error));
      }
    };
    worker.postMessage(request);
  });
}
