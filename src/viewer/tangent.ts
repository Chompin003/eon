import type { SkyRegion, ViewState } from '../shared';
const RAD = Math.PI / 180;

/** Gnomonic (TAN) coordinates in degrees; RA is continuous across zero. */
export function tangentPlane(longitude: number, latitude: number) {
  const ra = longitude * RAD,
    dec = latitude * RAD;
  const sr = Math.sin(ra),
    cr = Math.cos(ra),
    sd = Math.sin(dec),
    cd = Math.cos(dec);
  return {
    worldToPlane(lon: number, lat: number): [number, number] | undefined {
      const a = lon * RAD,
        d = lat * RAD;
      const x = Math.cos(d) * Math.cos(a),
        y = Math.cos(d) * Math.sin(a),
        z = Math.sin(d);
      const depth = x * cd * cr + y * cd * sr + z * sd;
      if (depth <= 0) return;
      return [
        (-x * sr + y * cr) / depth / RAD,
        (-x * sd * cr - y * sd * sr + z * cd) / depth / RAD,
      ];
    },
    planeToWorld(x: number, y: number): [number, number] {
      const u = x * RAD,
        v = y * RAD;
      const px = cd * cr - u * sr - v * sd * cr;
      const py = cd * sr + u * cr - v * sd * sr;
      const pz = sd + v * cd;
      return [
        (((Math.atan2(py, px) / RAD) % 360) + 360) % 360,
        Math.atan2(pz, Math.hypot(px, py)) / RAD,
      ];
    },
  };
}

export function regionGrid(region: SkyRegion) {
  // Match native SPHEREx sampling. Zoom magnifies these pixels without inventing detail.
  const size = Math.max(
    12,
    Math.min(region.extended ? 512 : 256, Math.ceil((region.sizeDeg * 3600) / 6.15)),
  );
  const scaleDeg = (2 * Math.tan((region.sizeDeg * RAD) / 2)) / RAD / size;
  const plane = tangentPlane(region.longitude, region.latitude);
  return {
    size,
    scaleDeg,
    pixelToWorld: (x: number, y: number) =>
      plane.planeToWorld((size / 2 - x) * scaleDeg, (size / 2 - y) * scaleDeg),
    worldToPixel: (ra: number, dec: number): [number, number] | undefined => {
      const xy = plane.worldToPlane(ra, dec);
      return xy ? [size / 2 - xy[0] / scaleDeg, size / 2 - xy[1] / scaleDeg] : undefined;
    },
  };
}

/** Keep ViewState.fov equal to the true angular width, including off-axis pans. */
export function gridCamera(grid: ReturnType<typeof regionGrid>, view: ViewState) {
  const center = grid.worldToPixel(view.longitude, view.latitude);
  if (!center) return;
  const xi = (grid.size / 2 - center[0]) * grid.scaleDeg * RAD,
    eta = (grid.size / 2 - center[1]) * grid.scaleDeg * RAD;
  const a = Math.hypot(1, eta),
    radius2 = a * a + xi * xi,
    t = Math.tan(view.fov * RAD);
  const root = Math.hypot(a, t * Math.sqrt(radius2));
  const half = view.fov < 90 ? (t * radius2) / (a + root) : (a + root) / -t;
  return { center, span: (2 * half) / RAD / grid.scaleDeg };
}
