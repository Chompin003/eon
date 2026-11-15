import { memo, useEffect, useMemo, useState } from 'react';
import {
  OBJECT_STYLES,
  objectPosition,
  observationYear,
  type RegionStudy,
  type SkyProjection,
  type StudyObject,
} from '../shared';
interface Props {
  result: RegionStudy;
  projection: SkyProjection;
  date?: string;
  selected?: string;
  onSelect: (object: StudyObject) => void;
}
export const StudyMarkers = memo(function StudyMarkers({
  result,
  projection,
  date,
  selected,
  onSelect,
}: Props) {
  const [revision, refresh] = useState(0);
  useEffect(() => projection.subscribe(() => refresh((n) => n + 1)), [projection]);
  const year = observationYear(date);
  const markers = useMemo(() => {
    const [width, height] = projection.getSize();
    const ordered = [...result.objects].sort(
      (a, b) => Number(b.provider === 'SIMBAD') - Number(a.provider === 'SIMBAD'),
    );
    const visible = ordered.flatMap((o) => {
      const at = objectPosition(o, year),
        p = projection.worldToPixel(at[0], at[1]);
      return p &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        p[0] >= 0 &&
        p[0] <= width &&
        p[1] >= 0 &&
        p[1] <= height
        ? [{ o, p }]
        : [];
    });
    const top = visible.slice(0, 200);
    const chosen = visible.find((m) => m.o.id === selected);
    if (chosen && !top.includes(chosen)) {
      top.pop();
      top.push(chosen);
    }
    return { width, height, items: top };
  }, [result, projection, year, revision, selected]);
  return (
    <svg
      className="study-markers"
      viewBox={`0 0 ${markers.width} ${markers.height}`}
      aria-label="Objetos catalogados de la región"
    >
      {markers.items.map(({ o, p }) => (
        <g
          key={o.id}
          transform={`translate(${p[0]} ${p[1]})`}
          role="button"
          tabIndex={0}
          aria-label={`${o.name} · ${OBJECT_STYLES[o.category].label} · ${o.provider}`}
          data-object-id={o.id}
          data-provider={o.provider}
          style={{ color: OBJECT_STYLES[o.category].color }}
          onClick={() => onSelect(o)}
          onKeyDown={(e) => {
            if (['Enter', ' '].includes(e.key)) {
              e.preventDefault();
              onSelect(o);
            }
          }}
        >
          <title>
            {o.name} · {o.description}
          </title>
          <circle
            r={selected === o.id ? 11 : 8}
            fill="transparent"
            stroke={selected === o.id ? 'currentColor' : 'none'}
          />
          <path d="M-7 0H-3M3 0H7M0-7V-3M0 3V7" />
          {(o.provider === 'SIMBAD' || selected === o.id) && (
            <text x="11" y="-8">
              {selected === o.id ? o.name : OBJECT_STYLES[o.category].label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
});
