/// <reference lib="webworker" />
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
const gif = GIFEncoder();
let frames = 0;
self.onmessage = (
  event: MessageEvent<{
    pixels?: ArrayBuffer;
    width: number;
    height: number;
    delay: number;
    finish?: boolean;
  }>,
) => {
  try {
    const { pixels, width, height, delay, finish } = event.data;
    if (finish) {
      if (frames < 2) throw Error('Se necesitan al menos dos imágenes para un GIF.');
      gif.finish();
      const bytes = new Uint8Array(gif.bytes());
      self.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
      return;
    }
    if (!pixels || width < 1 || height < 1 || width * height > 1024 * 1024 || frames >= 200)
      throw Error('La animación supera los límites de exportación.');
    const rgba = new Uint8Array(pixels);
    if (rgba.length !== width * height * 4) throw Error('Cuadro GIF incompleto.');
    const palette = quantize(rgba, 256, { format: 'rgb565' });
    gif.writeFrame(applyPalette(rgba, palette, 'rgb565'), width, height, {
      palette,
      delay: Math.max(100, Math.min(5000, delay)),
      repeat: 0,
    });
    frames++;
    if (gif.bytes().byteLength > 80 * 1024 * 1024)
      throw Error('El GIF excede 80 MB. Prueba una resolución menor.');
    self.postMessage({ ready: frames });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
