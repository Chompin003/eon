import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  normalizeView,
  separationArcsec,
  validRegionSize,
  regionWithMode,
  formatAngularSize,
  type SkyProjection,
  type SkyRegion,
  type ViewState,
} from '../shared';
interface Box {
  x: number;
  y: number;
  side: number;
}
type Corner = 'nw' | 'ne' | 'sw' | 'se';
interface Drag {
  kind: 'draw' | 'move' | Corner;
  x: number;
  y: number;
  box: Box;
  moved: boolean;
}
export function RegionSelector({
  projection,
  view,
  onViewChange,
  onSelect,
  onCancel,
  extended = false,
  onExtendedChange,
}: {
  projection: SkyProjection;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onSelect: (region: SkyRegion) => void;
  onCancel: () => void;
  extended?: boolean;
  onExtendedChange?: (enabled: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | undefined>(undefined);
  const [box, setBox] = useState<Box>();
  const [, refresh] = useState(0);
  useEffect(() => projection.subscribe(() => refresh((n) => n + 1)), [projection]);
  const [width, height] = projection.getSize(),
    actual = projection.getView();
  const ready =
    width > 1 &&
    height > 1 &&
    Math.abs(((actual.longitude - view.longitude + 540) % 360) - 180) < 1e-6 &&
    Math.abs(actual.latitude - view.latitude) < 1e-6 &&
    Math.abs(actual.fov - view.fov) < Math.max(1e-8, view.fov * 1e-5);
  const centered = {
    x: width / 2 - Math.min(width, height) * 0.15,
    y: height / 2 - Math.min(width, height) * 0.15,
    side: Math.min(width, height) * 0.3,
  };
  const shown = box ?? centered;
  const measure = (value: Box): SkyRegion | undefined => {
    const center = projection.pixelToWorld(value.x + value.side / 2, value.y + value.side / 2),
      left = projection.pixelToWorld(value.x, value.y + value.side / 2),
      right = projection.pixelToWorld(value.x + value.side, value.y + value.side / 2);
    if (!center || !left || !right || ![...center, ...left, ...right].every(Number.isFinite))
      return;
    return regionWithMode(
      { longitude: center[0], latitude: center[1], sizeDeg: separationArcsec(left, right) / 3600 },
      extended,
    );
  };
  const region = ready ? measure(shown) : undefined;
  const valid = Boolean(region && validRegionSize(region.sizeDeg, extended));
  const tooWide = region && region.sizeDeg > (extended ? 1 : 0.25);
  const constrain = (value: Box): Box => {
    const side = Math.max(8, Math.min(value.side, width, height));
    return {
      side,
      x: Math.max(0, Math.min(width - side, value.x)),
      y: Math.max(0, Math.min(height - side, value.y)),
    };
  };
  useEffect(() => {
    host.current?.focus({ preventScroll: true });
  }, []);
  const commit = () => {
    if (region && valid) onSelect(region);
  };
  const begin = (event: PointerEvent, kind: Drag['kind']) => {
    if (!ready || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = host.current!.getBoundingClientRect(),
      x = event.clientX - bounds.left,
      y = event.clientY - bounds.top;
    drag.current = { kind, x, y, box: shown, moved: false };
    host.current!.setPointerCapture(event.pointerId);
    host.current!.focus({ preventScroll: true });
  };
  const corners: Corner[] = ['nw', 'ne', 'sw', 'se'];
  return (
    <div
      className="region-selector"
      role="application"
      aria-label="Seleccionar región del cielo"
      aria-busy={!ready}
      ref={host}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) begin(event, 'draw');
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const bounds = event.currentTarget.getBoundingClientRect(),
          x = event.clientX - bounds.left,
          y = event.clientY - bounds.top;
        d.moved ||= Math.hypot(x - d.x, y - d.y) > 4;
        if (d.kind === 'move')
          setBox(constrain({ ...d.box, x: d.box.x + x - d.x, y: d.box.y + y - d.y }));
        else if (d.kind === 'draw') {
          const dx = x - d.x,
            dy = y - d.y;
          const side = Math.min(
            Math.max(Math.abs(dx), Math.abs(dy)),
            dx < 0 ? d.x : width - d.x,
            dy < 0 ? d.y : height - d.y,
          );
          setBox(constrain({ x: dx < 0 ? d.x - side : d.x, y: dy < 0 ? d.y - side : d.y, side }));
        } else {
          const west = d.kind.includes('w'),
            north = d.kind.includes('n'),
            fx = west ? d.box.x + d.box.side : d.box.x,
            fy = north ? d.box.y + d.box.side : d.box.y;
          const side = Math.min(
            Math.max(8, west ? fx - x : x - fx, north ? fy - y : y - fy),
            west ? fx : width - fx,
            north ? fy : height - fy,
          );
          setBox(constrain({ x: west ? fx - side : fx, y: north ? fy - side : fy, side }));
        }
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = undefined;
        if (d?.kind === 'draw' && !d.moved)
          setBox(
            constrain({ ...centered, x: d.x - centered.side / 2, y: d.y - centered.side / 2 }),
          );
      }}
      onPointerCancel={() => {
        drag.current = undefined;
      }}
      onWheel={(event) =>
        onViewChange(normalizeView({ ...view, fov: view.fov * Math.exp(event.deltaY * 0.001) }))
      }
      onKeyDown={(event) => {
        if (
          event.key !== 'Escape' &&
          (event.target as HTMLElement).closest('.region-selection-help')
        )
          return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          commit();
        } else if (['+', '=', '-'].includes(event.key)) {
          event.preventDefault();
          const delta = event.key === '-' ? -10 : 10;
          setBox(
            constrain({
              ...shown,
              x: shown.x - delta / 2,
              y: shown.y - delta / 2,
              side: shown.side + delta,
            }),
          );
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          const amount = event.shiftKey ? 2 : 10;
          setBox(
            constrain({
              ...shown,
              x:
                shown.x +
                (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0),
              y:
                shown.y +
                (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0),
            }),
          );
        }
      }}
    >
      <div
        className={'region-outline' + (region && !valid ? ' region-outline-invalid' : '')}
        style={{ left: shown.x, top: shown.y, width: shown.side, height: shown.side }}
        onPointerDown={(event) => begin(event, 'move')}
      >
        {corners.map((corner) => (
          <button
            key={corner}
            type="button"
            className={'region-corner region-corner-' + corner}
            aria-label={'Redimensionar esquina ' + corner}
            onPointerDown={(event) => begin(event, corner)}
            onKeyDown={(event) => {
              if (!event.key.startsWith('Arrow')) return;
              event.preventDefault();
              event.stopPropagation();
              const grow = event.key === 'ArrowRight' || event.key === 'ArrowDown',
                delta = grow ? 10 : -10;
              setBox(constrain({ ...shown, side: shown.side + delta }));
            }}
          />
        ))}
      </div>
      <div className="region-selection-help">
        <strong>
          {!ready
            ? 'Preparando la selección…'
            : region
              ? 'Región de ' + formatAngularSize(region.sizeDeg) + ' de lado'
              : 'Fuera de la proyección: mueve el cuadro hacia el centro.'}
        </strong>
        <span>
          Arrastra el cuadro o sus esquinas. Flechas para mover, +/− para tamaño. Confirma con Enter
          o el botón.
        </span>
        <span className="region-limits">
          Mínimo 1.2′ · máximo {extended ? '60′ ampliado' : '15′ normal'}.
        </span>
        {ready && region && !valid && (
          <div className="scientific-notice scientific-notice-error" role="alert">
            <strong>
              {tooWide
                ? 'Esta región supera el máximo de ' + (extended ? '60′' : '15′') + '.'
                : 'Esta región es menor del mínimo de 1.2′.'}
            </strong>
            <p>
              {tooWide && !extended
                ? 'Activa el modo ampliado para incluir un campo mayor.'
                : 'Ajusta las esquinas o el zoom hasta quedar dentro de los límites.'}
            </p>
          </div>
        )}
        <label className="extended-option">
          <input
            type="checkbox"
            checked={extended}
            onChange={(event) => onExtendedChange?.(event.target.checked)}
          />
          Modo ampliado · hasta 60′
        </label>
        {extended && (
          <p className="scientific-notice">
            Más cielo, más espera: hasta 16 veces el área normal y mayor uso de memoria. No añade
            resolución a los datos.
          </p>
        )}
        <div className="time-actions">
          <button className="plain-button" disabled={!ready || !valid} onClick={commit}>
            Usar esta región
          </button>
          <button className="plain-button" onClick={onCancel}>
            Cancelar selección
          </button>
        </div>
      </div>
    </div>
  );
}
