import { memo, useEffect, useMemo, useState } from 'react';
import { OBJECT_STYLES, type PixelStudy, type SkyProjection } from '../shared';
interface Props {
  result: PixelStudy;
  frameId: string;
  projection: SkyProjection;
  selected?: string;
  onSelect: (id: string) => void;
}
export const DetectionMarkers = memo(function DetectionMarkers({
  result,
  frameId,
  projection,
  selected,
  onSelect,
}: Props) {
  const [revision, refresh] = useState(0);
  useEffect(() => projection.subscribe(() => refresh((n) => n + 1)), [projection]);
  const tracks = useMemo(
    () =>
      new Map(
        result.tracks.flatMap((t) => t.measurements.map((m) => [m.detectionId, t.id] as const)),
      ),
    [result],
  );
  const markers = useMemo(() => {
    const [width, height] = projection.getSize();
    const frame = result.frames.find((f) => f.frameId === frameId);
    const entries = (frame?.detections ?? []).flatMap((d) => {
      const p = projection.worldToPixel(d.longitude, d.latitude);
      return p &&
        p.every(Number.isFinite) &&
        p[0] >= 0 &&
        p[0] <= width &&
        p[1] >= 0 &&
        p[1] <= height
        ? [{ d, p, track: tracks.get(d.id)! }]
        : [];
    });
    const visible = entries.slice(0, 200),
      active = entries.find((e) => e.track === selected);
    if (active && !visible.includes(active)) {
      visible.pop();
      visible.push(active);
    }
    return { width, height, entries: visible };
  }, [result, frameId, projection, revision, selected, tracks]);
  return (
    <svg
      className="study-markers detection-markers"
      viewBox={`0 0 ${markers.width} ${markers.height}`}
      aria-label="Fuentes detectadas en los píxeles"
    >
      {markers.entries.map(({ d, p, track }) => (
        <g
          key={d.id}
          transform={`translate(${p[0]} ${p[1]})`}
          role="button"
          tabIndex={0}
          aria-label={`${track} · ${OBJECT_STYLES[d.category].label} · ${d.association}`}
          data-detection-id={d.id}
          data-track-id={track}
          data-association={d.association}
          style={{ color: OBJECT_STYLES[d.category].color }}
          onClick={() => onSelect(track)}
          onKeyDown={(e) => {
            if (['Enter', ' '].includes(e.key)) {
              e.preventDefault();
              onSelect(track);
            }
          }}
        >
          <title>
            {track} · centroide medido ·{' '}
            {d.association === 'ambiguous'
              ? 'asociación ambigua'
              : d.association === 'candidate'
                ? 'asociación candidata'
                : 'sin contraparte'}
          </title>
          <circle
            r={selected === track ? 12 : 9}
            fill="transparent"
            stroke={selected === track ? 'currentColor' : 'none'}
          />
          <path d="M-9 0H-3M3 0H9M0-9V-3M0 3V9" />
          <text x="11" y="-9">
            {track}
            {selected === track ? ' · ' + OBJECT_STYLES[d.category].label : ''}
          </text>
        </g>
      ))}
    </svg>
  );
});
