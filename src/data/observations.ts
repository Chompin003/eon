import type { Observation, ViewState } from '../shared';

export function parseObservations(text: string): {
  observations: Observation[];
  truncated: boolean;
} {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('IRSA devolvió metadatos ilegibles.');
  const statuses = [...xml.getElementsByTagNameNS('*', 'INFO')].filter(
    (el) => el.getAttribute('name') === 'QUERY_STATUS',
  );
  if (statuses.some((el) => el.getAttribute('value') === 'ERROR'))
    throw new Error('IRSA rechazó la consulta de imágenes.');
  const table = xml.getElementsByTagNameNS('*', 'TABLE')[0];
  if (!table) throw new Error('La respuesta de IRSA no contiene una tabla.');
  const fields = [...table.getElementsByTagNameNS('*', 'FIELD')].map((field) =>
    field.getAttribute('name'),
  );
  const indices = ['access_url', 't_min', 'energy_bandpassname', 'obs_id', 'obs_collection'].map(
    (field) => fields.indexOf(field),
  );
  if (indices.some((index) => index < 0))
    throw new Error('Cambió el formato de las exposiciones de IRSA.');
  const [urlIndex, timeIndex, detectorIndex, idIndex, collectionIndex] = indices;
  const unique = new Map<string, Observation>();
  for (const row of table.getElementsByTagNameNS('*', 'TR')) {
    const cells = [...row.getElementsByTagNameNS('*', 'TD')].map(
      (cell) => cell.textContent?.trim() ?? '',
    );
    const url = cells[urlIndex];
    const mjd = Number(cells[timeIndex]);
    const detector = cells[detectorIndex];
    if (
      !/^https:\/\/irsa\.ipac\.caltech\.edu\/ibe\/data\/spherex\/(dr1|qr3)\/level2\/[A-Za-z0-9_./-]+\.fits$/.test(
        url,
      ) ||
      !Number.isFinite(mjd) ||
      !/^SPHEREx-D[1-6]$/.test(detector)
    )
      continue;
    const id = `${cells[idIndex]}:${detector}`;
    unique.set(id, {
      id,
      dateUtc: new Date((mjd - 40587) * 86400000).toISOString(),
      mjd,
      detector,
      url,
      collection: cells[collectionIndex],
    });
  }
  return {
    observations: [...unique.values()].sort((a, b) => a.mjd - b.mjd),
    truncated: statuses.some((el) => el.getAttribute('value') === 'OVERFLOW'),
  };
}

/** SIA has a per-response row cap. Recover every time window before reporting
 * completeness; overlapping boundaries are deduplicated by observation/detector. */
export async function loadAllObservations(
  view: ViewState,
  year: string,
  signal: AbortSignal,
  onProgress: (text: string) => void,
  sizeDeg?: number,
) {
  let queries = 0;
  const request = async (start?: number, end?: number) => {
    const params = new URLSearchParams({ ra: String(view.longitude), dec: String(view.latitude) });
    if (sizeDeg !== undefined) params.set('radius', String(sizeDeg / Math.SQRT2));
    if (sizeDeg !== undefined && sizeDeg > 0.25) params.set('extended', '1');
    if (start !== undefined && end !== undefined) {
      params.set('start', String(start));
      params.set('end', String(end));
    } else if (year) params.set('year', year);
    onProgress(queries++ ? `Completando archivo · consulta ${queries}` : 'Consultando IRSA…');
    const response = await fetch(`/api/observations?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
    });
    if (!response.ok) throw new Error('IRSA no respondió a la búsqueda. Reintenta.');
    return parseObservations(await response.text());
  };
  const first = await request();
  if (!first.truncated) return first;
  const start = Date.UTC(year ? Number(year) : 2025, 0, 1) / 86400000 + 40587;
  const end = year
    ? Date.UTC(Number(year) + 1, 0, 1) / 86400000 + 40587
    : Date.now() / 86400000 + 40587;
  async function split(lo: number, hi: number, depth: number): Promise<Observation[]> {
    if (depth > 20)
      throw new Error(
        'IRSA sigue truncando una ventana temporal muy pequeña. No se presentan resultados incompletos.',
      );
    const result = await request(lo, hi);
    if (!result.truncated) return result.observations;
    const mid = (lo + hi) / 2;
    return [...(await split(lo, mid, depth + 1)), ...(await split(mid, hi, depth + 1))];
  }
  const records = await split(start, end, 0);
  const unique = new Map<string, Observation>();
  for (const record of records) {
    const previous = unique.get(record.id);
    if (!previous || !previous.collection.startsWith('spherex_dr1')) unique.set(record.id, record);
  }
  return { observations: [...unique.values()].sort((a, b) => a.mjd - b.mjd), truncated: false };
}
