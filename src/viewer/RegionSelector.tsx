import { useEffect, useRef, useState } from 'react';
import { normalizeView, type SkyProjection, type SkyRegion, type ViewState } from '../shared';
interface Box {
  x: number;
  y: number;
  side: number;
}
export function RegionSelector({
  projection,
  view,
  onViewChange,
  onSelect,
  onCancel,
}: {
  projection: SkyProjection;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onSelect: (region: SkyRegion) => void;
  onCancel: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const [box, setBox] = useState<Box>();
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  useEffect(() => projection.subscribe(() => refresh((n) => n + 1)), [projection]);
  const [width, height] = projection.getSize();
  // The iframe applies navigation asynchronously. Do not measure the old zoom
  // if a selection is confirmed before the new projection has arrived.
  const actualView = projection.getView();
  const selectionReady =
    width > 1 &&
    height > 1 &&
    Math.abs(((actualView.longitude - view.longitude + 540) % 360) - 180) < 1e-6 &&
    Math.abs(actualView.latitude - view.latitude) < 1e-6 &&
    Math.abs(actualView.fov - view.fov) < Math.max(1e-8, view.fov * 1e-5);
  const centered = {
    x: width / 2 - Math.min(width, height) * 0.15,
    y: height / 2 - Math.min(width, height) * 0.15,
    side: Math.min(width, height) * 0.3,
  };
  const shown = box ?? centered;
  useEffect(() => {
    host.current?.focus({ preventScroll: true });
  }, []);
  function commit(candidate: Box) {
    if (!selectionReady) return;
    const center = projection.pixelToWorld(
      candidate.x + candidate.side / 2,
      candidate.y + candidate.side / 2,
    );
    const left = projection.pixelToWorld(candidate.x, candidate.y + candidate.side / 2);
    const right = projection.pixelToWorld(
      candidate.x + candidate.side,
      candidate.y + candidate.side / 2,
    );
    if (!center || !left || !right) return;
    const rad = Math.PI / 180,
      ddec = (right[1] - left[1]) * rad,
      dra = (right[0] - left[0]) * rad;
    const h =
      Math.sin(ddec / 2) ** 2 +
      Math.cos(left[1] * rad) * Math.cos(right[1] * rad) * Math.sin(dra / 2) ** 2;
    const sizeDeg = (2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))) / rad;
    if (sizeDeg < 0.02 || sizeDeg > 0.25) {
      setError('Elige un lado de 1.2′ a 15′. Ajusta el zoom si hace falta.');
      return;
    }
    onSelect({ longitude: center[0], latitude: center[1], sizeDeg });
  }
  return (
    <div
      className="region-selector"
      role="application"
      aria-label="Seleccionar región del cielo"
      aria-busy={!selectionReady}
      ref={host}
      tabIndex={0}
      onPointerDown={(event) => {
        if (!selectionReady || event.button !== 0 || event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        start.current = { x: event.clientX - r.left, y: event.clientY - r.top };
        setError('');
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const r = event.currentTarget.getBoundingClientRect(),
          dx = event.clientX - r.left - start.current.x,
          dy = event.clientY - r.top - start.current.y;
        const side = Math.min(
          Math.max(Math.abs(dx), Math.abs(dy)),
          dx < 0 ? start.current.x : width - start.current.x,
          dy < 0 ? start.current.y : height - start.current.y,
        );
        setBox({
          x: dx < 0 ? start.current.x - side : start.current.x,
          y: dy < 0 ? start.current.y - side : start.current.y,
          side,
        });
      }}
      onPointerUp={() => {
        if (start.current) {
          const anchor = start.current;
          start.current = undefined;
          commit(
            box && box.side >= 8
              ? box
              : {
                  x: Math.max(0, Math.min(width - centered.side, anchor.x - centered.side / 2)),
                  y: Math.max(0, Math.min(height - centered.side, anchor.y - centered.side / 2)),
                  side: centered.side,
                },
          );
        }
      }}
      onPointerCancel={() => {
        start.current = undefined;
      }}
      onWheel={(event) =>
        onViewChange(normalizeView({ ...view, fov: view.fov * Math.exp(event.deltaY * 0.001) }))
      }
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(shown);
        }
      }}
    >
      <div
        className="region-outline"
        style={{ left: shown.x, top: shown.y, width: shown.side, height: shown.side }}
      />
      <div className="region-selection-help">
        <span>
          {!selectionReady
            ? 'Preparando la selección…'
            : error ||
              'Arrastra un cuadrado · rueda para zoom · Enter para confirmar · Esc para cancelar'}
        </span>
        <button className="plain-button" disabled={!selectionReady} onClick={() => commit(shown)}>
          Usar esta región
        </button>
        <button className="plain-button" onClick={onCancel}>
          Cancelar selección
        </button>
      </div>
    </div>
  );
}
