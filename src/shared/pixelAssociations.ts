import { objectPosition, observationYear } from './study';
import type { StudyObject } from './study';
import { separationArcsec, type DetectedExposure, type DetectionTrack } from './pixels';
/** Candidates are not confirmed identities. Multiple providers stay independent. */
export function associateDetections(
  frame: DetectedExposure,
  catalog: readonly StudyObject[],
  radius = 6.15,
): DetectedExposure {
  const objects = catalog.map((o) => ({
    o,
    position: objectPosition(o, observationYear(frame.dateUtc)),
  }));
  const detections = frame.detections.map((d) => {
    const matches = objects
      .flatMap(({ o, position }) => {
        const distance = separationArcsec([d.longitude, d.latitude], position);
        return distance <= radius
          ? [
              {
                id: o.id,
                name: o.name,
                provider: o.provider,
                category: o.category,
                distanceArcsec: distance,
                probability: o.probability,
              },
            ]
          : [];
      })
      .sort((a, b) => a.distanceArcsec - b.distanceArcsec);
    const unique = matches.filter((m, i) => !matches.slice(0, i).some((p) => p.name === m.name));
    return {
      ...d,
      candidates: unique,
      association:
        unique.length > 1
          ? ('ambiguous' as const)
          : unique.length === 1
            ? ('candidate' as const)
            : ('none' as const),
      category: unique.length === 1 ? unique[0].category : ('unknown' as const),
    };
  });
  const claims = new Map<string, number>();
  for (const d of detections)
    for (const c of d.candidates) claims.set(c.id, (claims.get(c.id) ?? 0) + 1);
  return {
    ...frame,
    detections: detections.map((d) =>
      d.association === 'candidate' && (claims.get(d.candidates[0].id) ?? 0) > 1
        ? { ...d, association: 'ambiguous', category: 'unknown' }
        : d,
    ),
  };
}
/** Mutual closest neighbors with a 1.5 arcsec ambiguity margin; no interpolation over gaps. */
export function linkDetections(
  frames: readonly DetectedExposure[],
  radius = 6.15,
  sourceOrder?: readonly string[],
): DetectionTrack[] {
  const tracks: { id: string; measurements: { frameId: string; detectionId: string }[] }[] = [];
  let previous: DetectedExposure | undefined;
  const assignment = new Map<string, number>();
  for (const frame of [...frames].sort((a, b) => a.mjd - b.mjd)) {
    const consecutive =
      !sourceOrder ||
      !previous ||
      sourceOrder.indexOf(frame.frameId) === sourceOrder.indexOf(previous.frameId) + 1;
    const prior = consecutive ? (previous?.detections ?? []) : [];
    const nearest = frame.detections.map((d) =>
      prior
        .map((p) => ({
          p,
          distance: separationArcsec([d.longitude, d.latitude], [p.longitude, p.latitude]),
        }))
        .filter((p) => p.distance <= radius)
        .sort((a, b) => a.distance - b.distance),
    );
    const backwards = new Map(
      prior.map((p) => [
        p.id,
        frame.detections
          .map((d) => ({
            id: d.id,
            distance: separationArcsec([p.longitude, p.latitude], [d.longitude, d.latitude]),
          }))
          .filter((d) => d.distance <= radius)
          .sort((a, b) => a.distance - b.distance),
      ]),
    );
    const clear = (list: readonly { distance: number }[]) =>
      list.length > 0 && (list.length === 1 || list[1].distance - list[0].distance >= 1.5);
    for (let i = 0; i < frame.detections.length; i++) {
      const d = frame.detections[i],
        candidates = nearest[i];
      let track: number | undefined;
      if (clear(candidates)) {
        const p = candidates[0].p;
        const reverse = backwards.get(p.id)!;
        if (clear(reverse) && reverse[0].id === d.id) track = assignment.get(p.id);
      }
      if (track === undefined) {
        track = tracks.length;
        tracks.push({ id: `D${String(track + 1).padStart(4, '0')}`, measurements: [] });
      }
      tracks[track].measurements.push({ frameId: frame.frameId, detectionId: d.id });
      assignment.set(d.id, track);
    }
    previous = frame;
  }
  return tracks;
}
