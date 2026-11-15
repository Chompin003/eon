/** One transferable RGBA frame at a time. Abort terminates the encoder and releases its heap. */
export function createGifEncoder(signal: AbortSignal) {
  const worker = new Worker(new URL('./gifWorker.ts', import.meta.url), { type: 'module' });
  let pending:
    | {
        resolve: (value: ArrayBuffer | undefined) => void;
        reject: (error: unknown) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const stop = () => {
    worker.terminate();
    clearTimeout(pending?.timer);
    pending?.reject(signal.reason ?? new DOMException('Exportación cancelada', 'AbortError'));
    pending = undefined;
  };
  signal.addEventListener('abort', stop, { once: true });
  worker.onmessage = (event: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => {
    const job = pending;
    clearTimeout(job?.timer);
    pending = undefined;
    if (event.data.error) job?.reject(Error(event.data.error));
    else job?.resolve(event.data.bytes);
  };
  worker.onerror = () => {
    clearTimeout(pending?.timer);
    pending?.reject(Error('Falló el codificador GIF. Prueba una resolución menor.'));
    pending = undefined;
  };
  const send = (message: object, transfer: Transferable[] = []) => {
    signal.throwIfAborted();
    return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        pending = undefined;
        reject(Error('La codificación tardó demasiado. Prueba una resolución menor.'));
      }, 60000);
      pending = { resolve, reject, timer };
      worker.postMessage(message, transfer);
    });
  };
  return {
    async write(canvas: HTMLCanvasElement, delay: number) {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      await send({ pixels: pixels.buffer, width: canvas.width, height: canvas.height, delay }, [
        pixels.buffer,
      ]);
    },
    async finish() {
      const bytes = await send({ finish: true });
      if (!bytes) throw Error('El GIF quedó vacío.');
      return new Blob([bytes], { type: 'image/gif' });
    },
    dispose() {
      clearTimeout(pending?.timer);
      signal.removeEventListener('abort', stop);
      worker.terminate();
    },
  };
}
