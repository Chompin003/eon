import {
  inStudyRegion,
  objectPosition,
  observationYear,
  type StudyObject,
  type SkyRegion,
  type RegionStudy,
  type ObjectClass,
} from '../shared';

function finite(value: unknown): number | undefined {
  if (value === null || value === undefined || String(value).trim() === '') return;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
export function gaiaClass(
  probabilities: StudyObject['probabilities'],
): Pick<StudyObject, 'category' | 'probability'> {
  const available = Object.entries(probabilities ?? {})
    .filter(
      (entry): entry is [string, number] =>
        entry[1] !== undefined && entry[1] >= 0 && entry[1] <= 1,
    )
    .sort((a, b) => b[1] - a[1]);
  if (
    !available.length ||
    available[0][1] < 0.8 ||
    available.reduce((sum, p) => sum + p[1], 0) > 1.01
  )
    return { category: 'unknown' };
  return { category: available[0][0] as ObjectClass, probability: available[0][1] };
}
export function parseGaia(text: string): { objects: StudyObject[]; truncated: boolean } {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (
    xml.querySelector('parsererror') ||
    [...xml.getElementsByTagNameNS('*', 'INFO')].some(
      (e) => e.getAttribute('name') === 'QUERY_STATUS' && e.getAttribute('value') === 'ERROR',
    )
  )
    throw Error('IRSA no pudo consultar Gaia DR3. Prueba una región menor.');
  const fields = [...xml.getElementsByTagNameNS('*', 'FIELD')].map((f) => f.getAttribute('name'));
  for (const key of ['source_id', 'ra', 'dec', 'ref_epoch'])
    if (!fields.includes(key)) throw Error('Cambió el formato del catálogo Gaia.');
  const rows = [...xml.getElementsByTagNameNS('*', 'TR')];
  const objects: StudyObject[] = [];
  for (const row of rows.slice(0, 1000)) {
    const cells = [...row.getElementsByTagNameNS('*', 'TD')].map(
      (c) => c.textContent?.trim() ?? '',
    );
    const get = (key: string) => cells[fields.indexOf(key)];
    const ra = finite(get('ra')),
      dec = finite(get('dec')),
      epoch = finite(get('ref_epoch')),
      id = get('source_id');
    if (
      ra === undefined ||
      dec === undefined ||
      epoch === undefined ||
      !/^\d{1,20}$/.test(id) ||
      ra < 0 ||
      ra >= 360 ||
      Math.abs(dec) > 90
    )
      continue;
    const probabilities = {
      star: finite(get('classprob_dsc_combmod_star')),
      galaxy: finite(get('classprob_dsc_combmod_galaxy')),
      quasar: finite(get('classprob_dsc_combmod_quasar')),
    };
    objects.push({
      id: 'gaia:' + id,
      name: 'Gaia DR3 ' + id,
      provider: 'Gaia DR3',
      longitude: ra,
      latitude: dec,
      referenceEpoch: epoch,
      pmra: finite(get('pmra')),
      pmdec: finite(get('pmdec')),
      probabilities,
      ...gaiaClass(probabilities),
      description:
        'Clasificación probabilística publicada por Gaia DSC; no recalibrada para SPHEREx.',
    });
  }
  return {
    objects,
    truncated:
      rows.length > 1000 ||
      [...xml.getElementsByTagNameNS('*', 'INFO')].some(
        (e) => e.getAttribute('value') === 'OVERFLOW',
      ),
  };
}
export function simbadClass(code: string): ObjectClass {
  if (['OpC', 'GlC', 'Cl*', 'As*', 'ClG', 'GrG'].includes(code)) return 'cluster';
  if (code.includes('*') || ['WD', 'BD'].includes(code)) return 'star';
  if (
    [
      'G',
      'GiG',
      'GiC',
      'AGN',
      'SyG',
      'Sy1',
      'Sy2',
      'LIN',
      'EmG',
      'SBG',
      'LSB',
      'bCG',
      'rG',
    ].includes(code)
  )
    return 'galaxy';
  if (['QSO', 'Bla', 'BLL'].includes(code)) return 'quasar';
  if (['HII', 'PN', 'SNR', 'RNe', 'MoC', 'DNe', 'Cld', 'ISM', 'Neb'].includes(code))
    return 'nebula';
  if (['OpC', 'GlC', 'Cl*', 'As*', 'ClG', 'GrG'].includes(code)) return 'cluster';
  return 'unknown';
}
export function parseSimbad(text: string): { objects: StudyObject[]; truncated: boolean } {
  const data = JSON.parse(text) as { metadata?: { name: string }[]; data?: unknown[][] };
  if (!Array.isArray(data.data) || !Array.isArray(data.metadata))
    throw Error('SIMBAD no devolvió una tabla válida.');
  const fields = data.metadata.map((f) => f.name);
  for (const name of ['main_id', 'ra', 'dec', 'otype'])
    if (!fields.includes(name)) throw Error('Cambió el formato de SIMBAD.');
  const objects: StudyObject[] = [];
  for (const row of data.data.slice(0, 1000)) {
    const get = (key: string) => row[fields.indexOf(key)];
    const ra = finite(get('ra')),
      dec = finite(get('dec')),
      name = get('main_id'),
      code = get('otype');
    if (
      ra === undefined ||
      dec === undefined ||
      typeof name !== 'string' ||
      typeof code !== 'string' ||
      ra < 0 ||
      ra >= 360 ||
      Math.abs(dec) > 90
    )
      continue;
    objects.push({
      id: 'simbad:' + name,
      name,
      provider: 'SIMBAD',
      longitude: ra,
      latitude: dec,
      referenceEpoch: 2000,
      pmra: finite(get('pmra')),
      pmdec: finite(get('pmdec')),
      category: simbadClass(code),
      description: String(get('description') ?? code) + ' · ' + code,
    });
  }
  return { objects, truncated: data.data.length > 1000 };
}
export async function studyRegion(
  region: SkyRegion,
  signal: AbortSignal,
  dataset?: 'ngc1491-example',
): Promise<RegionStudy> {
  const errors: string[] = [];
  let truncated = false;
  const parts = await Promise.all(
    (['gaia', 'simbad'] as const).map(async (provider) => {
      try {
        const query = new URLSearchParams({
          provider,
          ra: region.longitude.toFixed(9),
          dec: region.latitude.toFixed(9),
          size: region.sizeDeg.toFixed(6),
          ...(region.extended ? { extended: '1' } : {}),
        });
        const response = await fetch(
          dataset === 'ngc1491-example'
            ? '/examples/spherex/' + (provider === 'gaia' ? 'gaia.xml' : 'simbad.json')
            : '/api/catalog?' + query,
          {
            signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
          },
        );
        if (!response.ok)
          throw Error(
            `${provider === 'gaia' ? 'Gaia DR3' : 'SIMBAD'} no está disponible; reintenta o reduce la región.`,
          );
        const parsed = (provider === 'gaia' ? parseGaia : parseSimbad)(await response.text());
        truncated ||= parsed.truncated;
        return parsed.objects;
      } catch (error) {
        if (signal.aborted) throw error;
        errors.push(error instanceof Error ? error.message : 'Falló el catálogo.');
        return [];
      }
    }),
  );
  // Keep the two providers explicit. Matching positions alone is not an identity
  // proof, especially in crowded fields or when epochs differ.
  const year = observationYear();
  const objects = parts.flat().filter((o) => {
    const p = objectPosition(o, year);
    return inStudyRegion(p[0], p[1], region);
  });
  return { region, objects, errors, truncated, queriedAt: new Date().toISOString() };
}
