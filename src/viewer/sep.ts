import type { SkyRegion, DetectedExposure, SourceDetection } from '../shared';
import { inStudyRegion, separationArcsec } from '../shared';
import { readFitsImage } from './registerFits';
export interface SepModule {
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  HEAPU8: Uint8Array;
  _malloc: (bytes: number) => number;
  _free: (pointer: number) => void;
  _eon_extract: (
    data: number,
    mask: number,
    w: number,
    h: number,
    threshold: number,
    area: number,
    out: number,
    capacity: number,
    stats: number,
  ) => number;
}
let library: Promise<SepModule> | undefined;
export async function getSep(): Promise<SepModule> {
  if (!library) {
    const url = '/vendor/sep/sep.mjs';
    library = import(/* @vite-ignore */ url)
      .then((m) => m.default({ locateFile: (file: string) => '/vendor/sep/' + file }))
      .catch((error) => {
        library = undefined;
        throw error;
      });
  }
  return library;
}
export async function detectFits(
  bytes: ArrayBuffer,
  region: SkyRegion,
  frameId: string,
  dateUtc: string,
  threshold: number,
  provided?: SepModule,
): Promise<DetectedExposure> {
  const sep = provided ?? (await getSep()),
    im = readFitsImage(bytes);
  if (im.width < 8 || im.height < 8 || im.width * im.height > 262144)
    throw Error('La imagen excede el límite de análisis. Elige una región menor.');
  const capacity = 500,
    columns = 15,
    n = im.width * im.height;
  const data = sep._malloc(n * 4),
    mask = sep._malloc(n),
    out = sep._malloc(capacity * columns * 8),
    stats = sep._malloc(3 * 8);
  if (!data || !mask || !out || !stats) {
    for (const p of [data, mask, out, stats]) if (p) sep._free(p);
    throw Error('El detector no pudo reservar memoria.');
  }
  try {
    let valid = 0;
    for (let y = 0; y < im.height; y++)
      for (let x = 0; x < im.width; x++) {
        const i = y * im.width + x,
          value = im.pixel(x, y),
          good = Number.isFinite(value) && value > -1e30;
        sep.HEAPF32[data / 4 + i] = good ? value : 0;
        sep.HEAPU8[mask + i] = good ? 0 : 255;
        if (good) valid++;
      }
    if (valid < 25)
      throw Error('La exposición no tiene suficientes píxeles válidos para estimar el fondo.');
    const code = sep._eon_extract(
      data,
      mask,
      im.width,
      im.height,
      threshold,
      5,
      out,
      capacity,
      stats,
    );
    if (code) throw Error('SEP no pudo estimar el fondo o extraer fuentes en esta exposición.');
    const values = Array.from(sep.HEAPF64.subarray(out / 8, out / 8 + capacity * columns));
    const [background, noise, total] = sep.HEAPF64.subarray(stats / 8, stats / 8 + 3);
    const detections: SourceDetection[] = [];
    for (let i = 0; i < Math.min(total, capacity); i++) {
      const v = values.slice(i * columns, (i + 1) * columns),
        [ra, dec] = im.pixelToWorld(v[0], v[1]);
      if (
        ![ra, dec, v[0], v[1], v[2], v[3]].every(Number.isFinite) ||
        !inStudyRegion(ra, dec, region)
      )
        continue;
      const scale = separationArcsec(
        im.pixelToWorld(v[0] - 0.5, v[1]),
        im.pixelToWorld(v[0] + 0.5, v[1]),
      );
      detections.push({
        id: frameId + ':' + i,
        longitude: ra,
        latitude: dec,
        x: v[0],
        y: v[1],
        a: v[2],
        b: v[3],
        theta: v[4],
        fwhmArcsec: 2.354820045 * Math.sqrt((v[2] ** 2 + v[3] ** 2) / 2) * scale,
        pixelScaleArcsec: scale,
        peak: v[6],
        area: v[7],
        flags: v[8],
        apertureMean: Number.isFinite(v[12]) ? v[12] : undefined,
        apertureError: Number.isFinite(v[13]) ? v[13] : undefined,
        apertureFlags: v[14],
        association: 'none',
        candidates: [],
        category: 'unknown',
      });
    }
    const mjd = Number(im.header['MJD-OBS']);
    return {
      frameId,
      dateUtc,
      mjd: Number.isFinite(mjd) ? mjd : Date.parse(dateUtc) / 86400000 + 40587,
      bunit: im.header.BUNIT ?? 'unidad del FITS',
      background,
      noise,
      coverage: valid / n,
      truncated: total > capacity,
      detections,
    };
  } finally {
    for (const p of [data, mask, out, stats]) sep._free(p);
  }
}
