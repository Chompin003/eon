import { VIEW_LIMITS, type ViewState } from '../../shared';

export class CoordinateError extends Error {
  constructor(
    public readonly field: 'ra' | 'dec',
    message: string,
  ) {
    super(message);
  }
}

function parse(value: string, field: 'ra' | 'dec'): number {
  const isRA = field === 'ra';
  const name = isRA ? 'RA' : 'Dec';
  const match = value
    .trim()
    .replaceAll('−', '-')
    .match(/^([+-]?\d{1,2})(?:\s*:\s*|\s+)(\d{1,2})(?:\s*:\s*|\s+)(\d{1,2}(?:[.,]\d+)?)$/);
  const fail = (message: string): never => {
    throw new CoordinateError(field, `${name}: ${message}`);
  };
  if (!match) return fail('escribe tres valores separados por espacios o dos puntos.');
  const [, first, minuteText, secondText] = match;
  const whole = Number(first);
  const minutes = Number(minuteText);
  const seconds = Number(secondText.replace(',', '.'));
  if (isRA && (first.startsWith('-') || whole >= 24)) fail('las horas deben estar entre 0 y 23.');
  if (!isRA && Math.abs(whole) > 90) fail('los grados deben estar entre −90 y +90.');
  if (minutes >= 60 || seconds >= 60) fail('minutos y segundos deben ser menores que 60.');
  if (!isRA && Math.abs(whole) === 90 && (minutes !== 0 || seconds !== 0)) {
    fail('en ±90°, minutos y segundos deben ser cero.');
  }
  const magnitude = Math.abs(whole) + minutes / 60 + seconds / 3600;
  return isRA ? 15 * magnitude : (first.startsWith('-') ? -1 : 1) * magnitude;
}

export function convertCoordinates(ra: string, dec: string) {
  return { ra: parse(ra, 'ra'), dec: parse(dec, 'dec') };
}

/** Presentation only; never round the numeric navigation state through this text. */
export function formatSexagesimal(degrees: number, kind: 'ra' | 'dec'): string {
  const isRA = kind === 'ra';
  const value = isRA ? (((degrees % 360) + 360) % 360) / 15 : Math.abs(degrees);
  let ticks = Math.round(value * 3600 * 1e6);
  if (isRA) ticks %= 24 * 3600 * 1e6;
  const whole = Math.floor(ticks / (3600 * 1e6));
  const minutes = Math.floor(ticks / (60 * 1e6)) % 60;
  const seconds = (ticks % (60 * 1e6)) / 1e6;
  const sign = isRA ? '' : degrees < 0 || Object.is(degrees, -0) ? '-' : '+';
  return `${sign}${String(whole).padStart(2, '0')} ${String(minutes).padStart(2, '0')} ${seconds.toFixed(6).padStart(9, '0')}`;
}

/** A valid conversion outside the camera's range must not silently move to ±85°. */
export function coordinateTarget(
  ra: number,
  dec: number,
  view: Readonly<ViewState>,
): ViewState | null {
  if (Math.abs(dec) > VIEW_LIMITS.maxLatitude) return null;
  return { longitude: ra, latitude: dec, fov: view.fov };
}
