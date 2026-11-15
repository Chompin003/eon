import type { BufferStatus, FITSFrame, SkyRegion } from '../shared';
import { cachedRegion, storeRegion, type CachedRegionFrame } from './regionCache';

export interface RegionFrame {
  pixels: Float32Array;
  size: number;
  coverage: number;
}
const MAX_BYTES = 96 * 1024 * 1024;
const memory = new Map<string, RegionFrame>();
let memoryBytes = 0;
let worker: Worker | undefined;
let serial = 0;
const jobs = new Map<
  number,
  { resolve: (frame: RegionFrame) => void; reject: (e: Error) => void }
>();
function register(bytes: ArrayBuffer, region: SkyRegion): Promise<RegionFrame> {
  if (!worker) {
    worker = new Worker(new URL('./regionWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<RegionFrame & { id: number; error?: string }>) => {
      const job = jobs.get(event.data.id);
      if (!job) return;
      jobs.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else job.resolve(event.data);
    };
    worker.onerror = () => {
      for (const job of jobs.values())
        job.reject(new Error('Falló la preparación de la región. Reintenta.'));
      jobs.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++serial;
    jobs.set(id, { resolve, reject });
    worker!.postMessage({ id, bytes, region }, [bytes]);
  });
}
function remember(key: string, frame: RegionFrame) {
  memoryBytes -= memory.get(key)?.pixels.byteLength ?? 0;
  memory.delete(key);
  memory.set(key, frame);
  memoryBytes += frame.pixels.byteLength;
  while (memoryBytes > MAX_BYTES && memory.size > 1) {
    const first = memory.keys().next().value!;
    memoryBytes -= memory.get(first)!.pixels.byteLength;
    memory.delete(first);
  }
}
async function download(url: string, signal: AbortSignal) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(70000)]);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { signal: deadline, cache: 'force-cache' });
      if (response.ok) return await response.arrayBuffer();
      await response.body?.cancel();
      if (attempt >= 2 || (response.status < 500 && response.status !== 429))
        throw new RangeError(`IRSA no pudo cargar esta fecha (${response.status}).`);
    } catch (error) {
      if (error instanceof RangeError || deadline.aborted || attempt >= 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
}

/** Registration and cache are shared by both panes. A failed date never blocks others. */
export class RegionBuffer {
  readonly entries = new Map<string, RegionFrame>();
  readonly errors = new Map<string, string>();
  readonly frames: readonly FITSFrame[];
  readonly region: SkyRegion;
  complete = false;
  private listeners = new Set<() => void>();
  private bytes = 0;
  private hits = 0;
  private uncovered = new Set<string>();
  private limited = false;
  levels: [number, number] | undefined;
  constructor(frames: readonly FITSFrame[], region: SkyRegion) {
    this.frames = frames;
    this.region = region;
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    for (const listener of this.listeners) listener();
  }
  status(): BufferStatus {
    const missing = this.complete
      ? this.frames.filter((frame) => !this.entries.has(frame.id)).map((frame) => frame.id)
      : [...this.errors.keys()];
    return {
      total: this.frames.length,
      prepared: this.entries.size,
      ready: this.entries.size,
      failed: missing.length,
      bytes: this.bytes,
      complete: this.complete,
      cacheHits: this.hits,
      readyFrameIds: this.frames.filter((f) => this.entries.has(f.id)).map((f) => f.id),
      failedFrameIds: missing,
      errorMessage: this.errors.values().next().value,
      unavailableFrames: missing.map((id) => ({
        id,
        reason: this.errors.get(id) ?? 'La secuencia supera el límite de memoria. Filtra por año.',
        retryable: !this.uncovered.has(id) && !this.limited,
      })),
    };
  }
  async load(signal: AbortSignal) {
    let cursor = 0;
    const run = async () => {
      while (!signal.aborted && cursor < this.frames.length) {
        const frame = this.frames[cursor++];
        if (this.entries.has(frame.id) || this.uncovered.has(frame.id)) continue;
        const key = `tan-sip-v1:${JSON.stringify(this.region)}:${frame.url}`;
        try {
          let entry = memory.get(key);
          if (entry) this.hits++;
          if (!entry) {
            const cached = await cachedRegion(key);
            if (signal.aborted) return;
            if (cached) {
              entry = {
                pixels: new Float32Array(cached.pixels),
                size: cached.size,
                coverage: cached.coverage,
              };
              this.hits++;
            }
          }
          if (!entry) {
            const raw = await download(frame.url, signal);
            if (signal.aborted) return;
            entry = await register(raw, this.region);
            const saved: CachedRegionFrame = {
              key,
              pixels: entry.pixels.buffer as ArrayBuffer,
              size: entry.size,
              coverage: entry.coverage,
            };
            await storeRegion(saved);
          }
          if (signal.aborted) return;
          remember(key, entry);
          if (entry.coverage === 0) {
            this.uncovered.add(frame.id);
            throw new Error('Esta exposición no tiene píxeles válidos dentro de la región.');
          }
          if (this.bytes + entry.pixels.byteLength > MAX_BYTES) {
            cursor = this.frames.length;
            this.limited = true;
            throw new Error(
              'Esta secuencia supera 96 MB. Filtra por año para preparar el resto de las fechas.',
            );
          }
          this.entries.set(frame.id, entry);
          this.bytes += entry.pixels.byteLength;
          this.errors.delete(frame.id);
          if (!this.levels) {
            const sorted = Array.from(entry.pixels)
              .filter(Number.isFinite)
              .sort((a, b) => a - b);
            const lo = sorted[Math.floor(sorted.length * 0.01)],
              hi = sorted[Math.floor(sorted.length * 0.995)];
            this.levels = [lo, hi > lo ? hi : lo + 1];
          }
        } catch (error) {
          if (signal.aborted) return;
          this.errors.set(
            frame.id,
            error instanceof Error ? error.message : 'No se pudo preparar esta fecha.',
          );
        }
        this.notify();
      }
    };
    this.complete = false;
    this.notify();
    await Promise.all([run(), run(), run()]);
    if (!signal.aborted) {
      this.complete = true;
      this.notify();
    }
  }
}
