import type { ViewState } from './contracts';

export interface ExportLayers {
  space: boolean;
  annotations: boolean;
  markers: boolean;
}

/** File-safe sexagesimal presentation. Navigation remains ICRS in degrees. */
export function exportCoordinates(view: Pick<ViewState, 'longitude' | 'latitude'>): string {
  const sexagesimal = (value: number, ra: boolean) => {
    let ticks = Math.round(Math.abs(value) * 3600 * 100);
    if (ra) ticks %= 24 * 3600 * 100;
    const whole = Math.floor(ticks / 360000),
      minutes = Math.floor(ticks / 6000) % 60,
      seconds = ((ticks % 6000) / 100).toFixed(2).padStart(5, '0');
    return `${String(whole).padStart(2, '0')}${ra ? 'h' : 'd'}${String(minutes).padStart(2, '0')}m${seconds}s`;
  };
  const ra = (((view.longitude % 360) + 360) % 360) / 15;
  const sign = view.latitude < 0 || Object.is(view.latitude, -0) ? '-' : '+';
  return `J2000_RA${sexagesimal(ra, true)}_Dec${sign}${sexagesimal(view.latitude, false)}`;
}

export function exportFilename(
  view: Pick<ViewState, 'longitude' | 'latitude'>,
  dates?: readonly [string, string],
): string {
  const utc = (date: string) => new Date(date).toISOString().slice(0, 19).replaceAll(':', '') + 'Z';
  return `eon_${exportCoordinates(view)}${dates ? `_${utc(dates[0])}--${utc(dates[1])}` : ''}.${dates ? 'gif' : 'png'}`;
}
