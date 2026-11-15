import type { ArchiveHiPSSource } from './contracts';

/** Explicit ESA registry allowlist, shared with the isolated viewer's validation. */
export const ARCHIVE_SURVEYS: readonly ArchiveHiPSSource[] = Object.freeze([
  {
    kind: 'archive-hips',
    id: 'ivo://ESAVO/P/HST/ACS-blue',
    title: 'Hubble · ACS',
    telescope: 'Hubble',
    instrument: 'ACS · todos los filtros',
    url: 'https://skies.esac.esa.int/HST/ACS/',
    releaseDate: '2016-11-11',
  },
  {
    kind: 'archive-hips',
    id: 'ivo://ESAVO/P/HST/WFC3',
    title: 'Hubble · WFC3',
    telescope: 'Hubble',
    instrument: 'WFC3 · todos los filtros',
    url: 'https://skies.esac.esa.int/HST/WFC3/',
    releaseDate: '2016-09-30',
  },
  {
    kind: 'archive-hips',
    id: 'ivo://ESAVO/P/JWST/NIRCam_Imaging',
    title: 'Webb · NIRCam',
    telescope: 'Webb',
    instrument: 'NIRCam · mosaico de archivo',
    url: 'https://skies.esac.esa.int/JWST/NIRCam_Imaging/',
    releaseDate: '2024-07-15',
  },
  {
    kind: 'archive-hips',
    id: 'ivo://ESAVO/P/JWST/P/MIRI_Imaging',
    title: 'Webb · MIRI',
    telescope: 'Webb',
    instrument: 'MIRI · mosaico de archivo',
    url: 'https://skies.esac.esa.int/JWST/MIRI_Imaging/',
    releaseDate: '2024-07-13',
  },
]);

export function isArchiveSource(value: unknown): value is ArchiveHiPSSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<ArchiveHiPSSource>;
  return (
    source.kind === 'archive-hips' &&
    ARCHIVE_SURVEYS.some((known) => known.url === source.url && known.id === source.id)
  );
}
