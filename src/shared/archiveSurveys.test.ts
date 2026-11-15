import { expect, it } from 'vitest';
import { ARCHIVE_SURVEYS, isArchiveSource } from './archiveSurveys';

it('restricts archive images to explicit ESA registry endpoints', () => {
  expect(ARCHIVE_SURVEYS).toHaveLength(4);
  for (const source of ARCHIVE_SURVEYS) expect(isArchiveSource(source)).toBe(true);
  expect(isArchiveSource({ ...ARCHIVE_SURVEYS[0], url: 'https://example.org/hips/' })).toBe(false);
  expect(isArchiveSource({ ...ARCHIVE_SURVEYS[0], id: 'unrecognized' })).toBe(false);
  expect(isArchiveSource(null)).toBe(false);
});
