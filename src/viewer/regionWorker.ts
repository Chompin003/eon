/// <reference lib="webworker" />
import { registerFits } from './registerFits';
import type { SkyRegion } from '../shared';
self.onmessage = (event: MessageEvent<{ id: number; bytes: ArrayBuffer; region: SkyRegion }>) => {
  const { id, bytes, region } = event.data;
  try {
    const result = registerFits(bytes, region);
    self.postMessage({ id, ...result }, [result.pixels.buffer]);
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'No se pudo preparar el cuadro.',
    });
  }
};
