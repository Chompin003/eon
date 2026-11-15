import type { ArchiveHiPSSource } from './contracts';

/** Explicit ESA registry allowlist, shared with the isolated viewer's validation. */
export const ARCHIVE_SURVEYS: readonly ArchiveHiPSSource[] = Object.freeze([
  {
    kind: 'archive-hips',
    id: 'HLA/ACS',
    title: 'Hubble · HLA FITS',
    telescope: 'Hubble',
    instrument: 'HLA · recortes por región',
    provider: 'HLA',
    format: 'fits',
    dataset: 'hst_10188_10_acs_wfc_f814w',
    url: 'https://hla.stsci.edu/cgi-bin/fitscut.cgi',
    releaseDate: 'archivo hasta 2017',
    target: { longitude: 180.471267, latitude: -18.882101, fov: 0.015 },
  },
  {
    kind: 'archive-hips',
    id: 'ivo://UFL/P/jwst-cmz-nircam-niriss-coadd',
    title: 'Webb · NIRCam/NIRISS · CMZ',
    telescope: 'Webb',
    instrument: 'NIRCam/NIRISS · centro galáctico',
    provider: 'Florida',
    url: 'https://starformation.astro.ufl.edu/avm_images/jwst_nir_hips/',
    releaseDate: '2026-09-15',
    target: { longitude: 266.5875292125761, latitude: -28.5884984451952, fov: 0.08 },
  },
  {
    kind: 'archive-hips',
    id: 'ivo://UFL/P/jwst-cmz-miri-coadd',
    title: 'Webb · MIRI · CMZ',
    telescope: 'Webb',
    instrument: 'MIRI · centro galáctico',
    provider: 'Florida',
    url: 'https://starformation.astro.ufl.edu/avm_images/jwst_miri_hips/',
    releaseDate: '2026-09-15',
    target: { longitude: 266.5823620486326, latitude: -28.62714090221641, fov: 0.04 },
  },
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
    ARCHIVE_SURVEYS.some(
      (known) =>
        known.url === source.url &&
        known.id === source.id &&
        known.format === source.format &&
        known.provider === source.provider &&
        (known.provider !== 'HLA' ||
          (typeof source.dataset === 'string' &&
            /^hst_[a-z0-9_]{5,100}$/.test(source.dataset) &&
            source.target &&
            [source.target.longitude, source.target.latitude, source.target.fov].every(
              Number.isFinite,
            ) &&
            source.target.longitude >= 0 &&
            source.target.longitude < 360 &&
            Math.abs(source.target.latitude) <= 90)),
    )
  );
}

export function archiveImageUrl(source: ArchiveHiPSSource): string {
  if (!isArchiveSource(source) || source.provider !== 'HLA') throw Error('Archivo HLA inválido');
  const q = new URLSearchParams({
    red: source.dataset!,
    RA: String(source.target!.longitude),
    Dec: String(source.target!.latitude),
    size: '512',
    format: 'fits',
  });
  return source.url + '?' + q;
}
