import { useEffect, useState } from 'react';
import { ARCHIVE_SURVEYS, type ArchiveHiPSSource, type SkyProjection } from '../shared';

/** Verified entry points, not footprints or an exhaustive observation catalogue. */
export function ArchiveRegions({
  projection,
  source,
  onOpen,
}: {
  projection: SkyProjection;
  source?: ArchiveHiPSSource;
  onOpen: (source: ArchiveHiPSSource) => void;
}) {
  const [, redraw] = useState(0);
  useEffect(() => projection.subscribe(() => redraw((n) => n + 1)), [projection]);
  const view = projection.getView();
  const fields = [ARCHIVE_SURVEYS[0], ARCHIVE_SURVEYS[1]];
  return (
    <div className="archive-fields" aria-label="Campos verificados de Hubble y Webb">
      {view.fov > 0.5 &&
        fields.map((field) => {
          const p = projection.worldToPixel(field.target!.longitude, field.target!.latitude);
          const [w, h] = projection.getSize();
          if (!p || p[0] < 0 || p[1] < 0 || p[0] > w || p[1] > h) return null;
          return (
            <button
              key={field.id}
              className="archive-field-marker"
              style={{ left: p[0], top: p[1] }}
              onClick={() => onOpen(field)}
            >
              ⊕ {field.telescope === 'Hubble' ? 'Hubble · Antenas' : 'Webb · centro galáctico'}
            </button>
          );
        })}
      {source?.target && view.fov > source.target.fov * 5 && (
        <button className="archive-field-guide" onClick={() => onOpen(source)}>
          Esta capa muestra una región pequeña. Ir al campo de {source.telescope} →
        </button>
      )}
    </div>
  );
}
