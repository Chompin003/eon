import { expect, it } from 'vitest';
import { ARCHIVE_SURVEYS, isArchiveSource, archiveImageUrl } from './archiveSurveys';

it('restricts archive images to explicit research provider endpoints', () => {
  expect(ARCHIVE_SURVEYS).toHaveLength(7);
  for (const source of ARCHIVE_SURVEYS) expect(isArchiveSource(source)).toBe(true);
  expect(isArchiveSource({ ...ARCHIVE_SURVEYS[0], url: 'https://example.org/hips/' })).toBe(false);
  expect(isArchiveSource({ ...ARCHIVE_SURVEYS[0], id: 'unrecognized' })).toBe(false);
  expect(isArchiveSource(null)).toBe(false);
});

it('bounds HLA cutouts and rejects arbitrary files, hosts and non-finite positions', () => {
  const source = ARCHIVE_SURVEYS[0];
  expect(isArchiveSource({ ...source, dataset: '../../secret' })).toBe(false);
  expect(isArchiveSource({ ...source, format: undefined })).toBe(false);
  expect(isArchiveSource({ ...source, target: { longitude: NaN, latitude: 0, fov: 1 } })).toBe(
    false,
  );
  const url = new URL(archiveImageUrl(source));
  expect(url.origin).toBe('https://hla.stsci.edu');
  expect(url.searchParams.get('size')).toBe('512');
  expect(url.searchParams.get('format')).toBe('fits');
});
