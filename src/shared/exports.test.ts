import { describe, expect, it } from 'vitest';
import { exportCoordinates, exportFilename } from './exports';
describe('export names in sexagesimal J2000', () => {
  it('preserves signed sub-degree declinations and carries RA into the next day', () => {
    expect(exportCoordinates({ longitude: 359.9999999, latitude: -0.2583333333 })).toBe(
      'J2000_RA00h00m00.00s_Dec-00d15m30.00s',
    );
    expect(exportCoordinates({ longitude: -15, latitude: -0 })).toContain('RA23h00m00.00s_Dec-00d');
  });
  it('names the actual exported UTC range without illegal filename characters', () => {
    const name = exportFilename({ longitude: 60.8109955, latitude: 51.3404038 }, [
      '2025-08-22T00:38:48.048Z',
      '2026-09-02T10:36:30.700Z',
    ]);
    expect(name).toBe(
      'eon_J2000_RA04h03m14.64s_Dec+51d20m25.45s_2025-08-22T003848Z--2026-09-02T103630Z.gif',
    );
    expect(name).not.toMatch(/[<>:"/\\|?*]/);
    expect(exportFilename({ longitude: 0, latitude: 90 })).toMatch(/Dec\+90d00m00.00s\.png$/);
  });
});
