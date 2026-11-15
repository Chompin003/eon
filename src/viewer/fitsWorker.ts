/// <reference lib="webworker" />
import { displayFits } from './sip';
self.onmessage = (event: MessageEvent<{ id: number; bytes: ArrayBuffer }>) => {
  try {
    const bytes = displayFits(event.data.bytes);
    self.postMessage({ id: event.data.id, bytes }, { transfer: [bytes] });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : 'No se pudo preparar el FITS.',
    });
  }
};
