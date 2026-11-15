import { separationArcsec, type SkyProjection } from '../shared';
export function angularScale(projection: SkyProjection) {
  const [width, height] = projection.getSize(),
    max = Math.min(140, width * 0.3);
  if (width < 80 || height < 80) return;
  const x = width - 22,
    y = height - 26;
  const at = projection.pixelToWorld(x, y);
  if (!at || !at.every(Number.isFinite)) return;
  const distance = (pixels: number) => {
    const other = projection.pixelToWorld(x - pixels, y);
    return other && other.every(Number.isFinite) ? separationArcsec(at, other) : NaN;
  };
  const available = distance(max);
  if (!Number.isFinite(available) || available <= 0) return;
  const unit = available >= 60 ? 60 : 1,
    value = available / unit;
  const power = 10 ** Math.floor(Math.log10(value));
  const nice = [1, 2, 5].filter((n) => n * power <= value).at(-1)! * power;
  const seconds = nice * unit;
  let lo = 0,
    hi = max;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (distance(mid) > seconds) hi = mid;
    else lo = mid;
  }
  const pixels = (lo + hi) / 2;
  const label = `${Number(nice.toPrecision(4))}${unit === 60 ? '′' : '″'}`;
  return { width, height, x, y, pixels, seconds, label };
}
