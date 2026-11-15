import { ARCHIVE_SURVEYS, type ArchiveHiPSSource, type ViewState } from '../shared';

export async function searchHubble(
  view: ViewState,
  signal: AbortSignal,
): Promise<ArchiveHiPSSource[]> {
  const q = new URLSearchParams({
    POS: `${view.longitude},${view.latitude}`,
    SIZE: '0.01',
    FORMAT: 'image/fits',
    inst: 'ACS,WFC3',
    imagetype: 'best',
  });
  const response = await fetch(`https://hla.stsci.edu/cgi-bin/hlaSIAP.cgi?${q}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  if (!response.ok) throw Error('HLA no respondió a la búsqueda.');
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024) throw Error('Reduce la región de búsqueda.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
  if (xml.querySelector('parsererror') || !xml.querySelector('TABLEDATA'))
    throw Error('Respuesta HLA no válida.');
  const fields = [...xml.querySelectorAll('FIELD')].map((field) => field.getAttribute('name'));
  const get = (cells: Element[], name: string) =>
    cells[fields.indexOf(name)]?.textContent?.trim() ?? '';
  const result: ArchiveHiPSSource[] = [];
  for (const row of xml.querySelectorAll('TR')) {
    const cells = [...row.querySelectorAll('TD')];
    const dataset = get(cells, 'Dataset');
    if (!/^hst_[a-z0-9_]{5,100}$/.test(dataset) || get(cells, 'Level') !== '2') continue;
    if (result.some((item) => item.dataset === dataset)) continue;
    result.push({
      ...ARCHIVE_SURVEYS[0],
      dataset,
      title: `Hubble · ${get(cells, 'Detector')} · ${get(cells, 'Spectral_Elt')}`,
      releaseDate: get(cells, 'StartTime'),
      target: { ...view, fov: 0.015 },
    });
    if (result.length === 20) break;
  }
  return result;
}
