import type { HiPSSource, SurveyMetadata } from '../shared';

/** Published by IRSA's official SPHEREx HiPS notebook; no third-party proxy. */
export const spherexSource: HiPSSource = Object.freeze({
  kind: 'hips',
  id: 'ivo://IPAC/P/SPHEREx/DR1/cube',
  title: 'SPHEREx DR1',
  url: 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube',
  frame: 62,
});

function mjdDate(value: string): string {
  const mjd = Number(value);
  if (!Number.isFinite(mjd)) throw new Error('Fecha MJD inválida en IRSA.');
  return new Date((mjd - 40587) * 86400000).toISOString().slice(0, 10);
}

export function parseSurveyMetadata(text: string): SurveyMetadata {
  const properties: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const equal = line.indexOf('=');
    if (equal > 0) properties[line.slice(0, equal).trim()] = line.slice(equal + 1).trim();
  }
  const depth = Number(properties.hips_cube_depth);
  const wavelengths = (properties.data_cube_crval3_arr ?? '').trim().split(/\s+/).map(Number);
  const pixelScale = Number(properties.hips_pixel_scale) * 3600;
  if (
    properties.creator_did !== spherexSource.id ||
    properties.hips_frame !== 'equatorial' ||
    depth !== 102 ||
    wavelengths.length !== depth ||
    wavelengths.some((value) => !Number.isFinite(value) || value <= 0) ||
    !Number.isFinite(pixelScale) ||
    pixelScale <= 0 ||
    !properties.hips_release_date
  )
    throw new Error('IRSA cambió el formato del cubo SPHEREx; hay que revisar la integración.');
  return {
    title: properties.obs_collection,
    releaseDate: properties.hips_release_date,
    pixelScaleArcsec: pixelScale,
    observationStart: mjdDate(properties.t_min),
    observationEnd: mjdDate(properties.t_max),
    // IRSA explicitly marks the two dichroic channels as blank (zero-based indices).
    channels: wavelengths.flatMap((wavelengthUm, frame) =>
      frame === 50 || frame === 51 ? [] : [{ frame, wavelengthUm }],
    ),
  };
}

export async function loadSurveyMetadata(signal: AbortSignal): Promise<SurveyMetadata> {
  const response = await fetch(`${spherexSource.url}/properties`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error(`IRSA respondió HTTP ${response.status}.`);
  return parseSurveyMetadata(await response.text());
}
