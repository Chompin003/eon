import type { BufferStatus, FITSFrame } from '../shared';

export interface PreparedFrame {
  frame: FITSFrame;
  bytes: ArrayBuffer;
}
const MAX_CACHE_BYTES = 96 * 1024 * 1024;
const cache = new Map<string, PreparedFrame>();
let cacheBytes = 0;
let worker: Worker | undefined;
let nextJob = 0;
const jobs = new Map<
  number,
  { resolve: (bytes: ArrayBuffer) => void; reject: (error: Error) => void }
>();

function prepare(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  if (!worker) {
    worker = new Worker(new URL('./fitsWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (
      event: MessageEvent<{ id: number; bytes?: ArrayBuffer; error?: string }>,
    ) => {
      const job = jobs.get(event.data.id);
      if (!job) return;
      jobs.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data.bytes!);
    };
    worker.onerror = () => {
      for (const job of jobs.values())
        job.reject(new Error('Falló la preparación de imágenes. Reintenta.'));
      jobs.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextJob;
    jobs.set(id, { resolve, reject });
    worker!.postMessage({ id, bytes }, [bytes]);
  });
}

function remember(key: string, entry: PreparedFrame) {
  cacheBytes -= cache.get(key)?.bytes.byteLength ?? 0;
  cache.delete(key);
  cache.set(key, entry);
  cacheBytes += entry.bytes.byteLength;
  while (cacheBytes > MAX_CACHE_BYTES && cache.size > 1) {
    const oldest = cache.keys().next().value!;
    cacheBytes -= cache.get(oldest)!.bytes.byteLength;
    cache.delete(oldest);
  }
}

/** One collection per coordinate/detector selection; shared by both visual panes. */
export class FrameBuffer {
  readonly entries = new Map<string, PreparedFrame>();
  readonly errors = new Map<string, string>();
  private listeners = new Set<() => void>();
  private bytes = 0;
  constructor(readonly frames: readonly FITSFrame[]) {}
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  status(): BufferStatus {
    return {
      total: this.frames.length,
      prepared: this.entries.size,
      ready: 0,
      failed: this.errors.size,
      bytes: this.bytes,
      errorMessage: this.errors.values().next().value,
    };
  }
  private notify() {
    for (const listener of this.listeners) listener();
  }
  async load(signal: AbortSignal) {
    let cursor = 0;
    const run = async () => {
      while (cursor < this.frames.length && !signal.aborted) {
        const frame = this.frames[cursor++];
        if (this.entries.has(frame.id)) continue;
        try {
          let entry = cache.get(frame.url);
          if (entry) {
            cache.delete(frame.url);
            cache.set(frame.url, entry);
          } else {
            let response: Response | undefined;
            for (let attempt = 0; attempt < 3; attempt++) {
              response = await fetch(frame.url, {
                signal: AbortSignal.any([signal, AbortSignal.timeout(70000)]),
                cache: 'force-cache',
              });
              if (response.ok) break;
              if (response.status < 500 && response.status !== 429) break;
              await response.body?.cancel();
              await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
            }
            if (!response?.ok)
              throw new Error(`IRSA no pudo cargar la exposición (${response?.status}).`);
            const raw = await response.arrayBuffer();
            if (signal.aborted) return;
            entry = { frame, bytes: await prepare(raw) };
            remember(frame.url, entry);
          }
          if (signal.aborted) return;
          if (this.bytes + entry.bytes.byteLength > MAX_CACHE_BYTES) {
            cursor = this.frames.length;
            throw new Error(
              'La secuencia supera 96 MB. Selecciona un año para reducirla; no se han omitido fechas.',
            );
          }
          this.entries.set(frame.id, { frame, bytes: entry.bytes });
          this.bytes += entry.bytes.byteLength;
        } catch (error) {
          if (signal.aborted) return;
          this.errors.set(
            frame.id,
            error instanceof Error ? error.message : 'No se pudo cargar esta exposición.',
          );
        }
        this.notify();
      }
    };
    await Promise.all([run(), run(), run()]);
  }
}
