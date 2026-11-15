import type { Observation } from '../shared';

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
