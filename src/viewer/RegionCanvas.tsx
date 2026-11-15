import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { normalizeView, type SkyProjection, type SkyRegion, type ViewState } from '../shared';
import { regionGrid, gridCamera } from './tangent';
import type { RegionBuffer, RegionFrame } from './regionBuffer';

// Perceptually ordered false-color anchors; values remain available in the original FITS.
const colors = [
  [0, 0, 0],
  [31, 39, 111],
  [19, 117, 154],
  [61, 186, 131],
  [229, 220, 62],
  [255, 255, 235],
];
function bitmap(frame: RegionFrame, mode: 'mono' | 'color', levels: [number, number]) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = frame.size;
  const ctx = surface.getContext('2d')!,
    rgba = ctx.createImageData(frame.size, frame.size);
  const denominator = Math.asinh(10);
  for (let i = 0; i < frame.pixels.length; i++) {
    const value = frame.pixels[i];
    if (!Number.isFinite(value)) continue;
    const t =
      Math.asinh(10 * Math.max(0, Math.min(1, (value - levels[0]) / (levels[1] - levels[0])))) /
      denominator;
    if (mode === 'mono') rgba.data.fill(Math.round(t * 255), i * 4, i * 4 + 3);
    else {
      const p = t * (colors.length - 1),
        lo = Math.min(colors.length - 2, Math.floor(p)),
        f = p - lo;
      for (let k = 0; k < 3; k++)
        rgba.data[i * 4 + k] = Math.round(colors[lo][k] * (1 - f) + colors[lo + 1][k] * f);
    }
    rgba.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(rgba, 0, 0);
  return surface;
}

interface Props {
  region: SkyRegion;
  buffer: RegionBuffer;
  frameId: string;
  mode: 'mono' | 'color';
  view: ViewState;
  revision: number;
  onViewChange: (view: ViewState) => void;
  onPresented: (ready: boolean) => void;
  renderAnnotations?: (projection: SkyProjection) => ReactNode;
  comparisonOverlay?: ReactNode;
  comparisonOpacity?: number;
}
export function RegionCanvas(props: Props) {
  const { region, buffer, frameId, mode, view } = props;
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(1);
  const grid = useMemo(() => regionGrid(region), [region]);
  const state = useRef({ view, size });
  state.current = { view, size };
  const listeners = useRef(new Set<() => void>());
  const images = useMemo(() => new Map<string, HTMLCanvasElement>(), [buffer]);
  const projection = useMemo<SkyProjection>(() => {
    const camera = () => {
      const { view, size } = state.current;
      const camera = gridCamera(grid, view);
      return { center: camera?.center, span: camera?.span ?? 1, size };
    };
    return {
      getSize: () => [state.current.size, state.current.size],
      getView: () => state.current.view,
      worldToPixel(ra, dec) {
        const { center, span, size } = camera(),
          p = grid.worldToPixel(ra, dec);
        return center && p
          ? [
              ((p[0] - center[0]) / span) * size + size / 2,
              ((p[1] - center[1]) / span) * size + size / 2,
            ]
          : undefined;
      },
      pixelToWorld(x, y) {
        const { center, span, size } = camera();
        return center
          ? grid.pixelToWorld(
              center[0] + (x / size - 0.5) * span,
              center[1] + (y / size - 0.5) * span,
            )
          : undefined;
      },
      subscribe(listener) {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    };
  }, [grid, region]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setSize(Math.max(1, entries[0].contentRect.width)),
    );
    observer.observe(host.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    for (const listener of listeners.current) listener();
  }, [view, size]);
  const callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    const frame = buffer.entries.get(frameId),
      element = canvas.current!;
    element.dataset.ready = 'false';
    callbacks.current.onPresented(false);
    if (size <= 1) return;
    const tick = requestAnimationFrame(() => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      element.width = element.height = Math.max(1, Math.round(size * dpr));
      const ctx = element.getContext('2d', { alpha: false })!;
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, element.width, element.height);
      if (!frame || !buffer.levels) return;
      const key = `${frameId}:${mode}`;
      let image = images.get(key);
      if (!image) {
        image = bitmap(frame, mode, buffer.levels);
        images.set(key, image);
        while (
          images.size * frame.size * frame.size * 4 > (region.extended ? 96 : 16) * 1024 * 1024 &&
          images.size > 1
        ) {
          const oldest = images.keys().next().value!;
          images.get(oldest)!.width = 0;
          images.delete(oldest);
        }
      }
      const camera = gridCamera(grid, view);
      if (
        !camera ||
        camera.center[0] + camera.span / 2 <= 0 ||
        camera.center[0] - camera.span / 2 >= grid.size ||
        camera.center[1] + camera.span / 2 <= 0 ||
        camera.center[1] - camera.span / 2 >= grid.size
      )
        return;
      if (camera) {
        const { center, span } = camera;
        const ratio = element.width / span;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          element.width / 2 - center[0] * ratio,
          element.height / 2 - center[1] * ratio,
          grid.size * ratio,
          grid.size * ratio,
        );
      }
      element.dataset.ready = 'true';
      element.dataset.frameId = frameId;
      callbacks.current.onPresented(true);
    });
    return () => cancelAnimationFrame(tick);
  }, [buffer, frameId, mode, grid, images, props.revision, region, size, view]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; view: ViewState; distance?: number } | undefined>(
    undefined,
  );
  const resetGesture = () => {
    const points = [...pointers.current.values()];
    gesture.current = points.length
      ? {
          ...points[0],
          view: callbacks.current.view,
          distance:
            points.length > 1
              ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
              : undefined,
        }
      : undefined;
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current,
      points = [...pointers.current.values()];
    if (points.length > 1 && g.distance) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (distance > 1)
        props.onViewChange(normalizeView({ ...g.view, fov: (g.view.fov * g.distance) / distance }));
    } else if (points.length === 1) {
      const camera = gridCamera(grid, g.view);
      if (!camera) return;
      const { center, span } = camera;
      const world = grid.pixelToWorld(
        center[0] - ((event.clientX - g.x) / size) * span,
        center[1] - ((event.clientY - g.y) / size) * span,
      );
      props.onViewChange(
        normalizeView({ longitude: world[0], latitude: world[1], fov: g.view.fov }),
      );
    }
  };
  const frame = buffer.entries.get(frameId);
  const currentCamera = gridCamera(grid, view);
  const outside =
    !currentCamera ||
    currentCamera.center[0] + currentCamera.span / 2 <= 0 ||
    currentCamera.center[0] - currentCamera.span / 2 >= grid.size ||
    currentCamera.center[1] + currentCamera.span / 2 <= 0 ||
    currentCamera.center[1] - currentCamera.span / 2 >= grid.size;
  const camera = gridCamera(grid, view);
  return (
    <div className="region-stage" ref={host}>
      <canvas
        ref={canvas}
        className="region-canvas"
        tabIndex={0}
        aria-label="Región animada SPHEREx"
        data-source="fits"
        data-mode={mode}
        data-buffered={buffer.entries.size}
        data-ra={view.longitude}
        data-dec={view.latitude}
        data-fov={view.fov}
        data-image-ra={region.longitude}
        data-image-dec={region.latitude}
        data-coverage={frame?.coverage ?? 0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          resetGesture();
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          resetGesture();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          resetGesture();
        }}
        onWheel={(event) => {
          props.onViewChange(
            normalizeView({ ...view, fov: view.fov * Math.exp(event.deltaY * 0.001) }),
          );
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            return;
          }
          if (event.key === 'Home') {
            event.preventDefault();
            props.onViewChange({
              longitude: region.longitude,
              latitude: region.latitude,
              fov: region.sizeDeg,
            });
            return;
          }
          if (['+', '=', '-', '−'].includes(event.key)) {
            event.preventDefault();
            props.onViewChange(
              normalizeView({
                ...view,
                fov: view.fov * (['+', '='].includes(event.key) ? 1 / 1.3 : 1.3),
              }),
            );
            return;
          }
          const step = size * 0.08,
            offset: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
          if (offset[event.key]) {
            event.preventDefault();
            const [dx, dy] = offset[event.key];
            const world = projection.pixelToWorld(size / 2 + dx, size / 2 + dy);
            if (world) props.onViewChange({ ...view, longitude: world[0], latitude: world[1] });
          }
        }}
      />
      {props.comparisonOverlay && (
        <div
          className="registered-archive"
          style={{
            opacity: props.comparisonOpacity,
            transform: camera
              ? `translate(${size / 2 - (camera.center[0] * size) / camera.span}px, ${size / 2 - (camera.center[1] * size) / camera.span}px) scale(${grid.size / camera.span})`
              : 'none',
          }}
        >
          {props.comparisonOverlay}
        </div>
      )}
      {props.renderAnnotations?.(projection)}
      {!frame && (
        <div className="region-message" role="status">
          {buffer.errors.get(frameId) ?? 'Preparando esta fecha…'}
        </div>
      )}
      {frame && outside && (
        <div className="region-message" role="status">
          Fuera de la región preparada. Restablece la vista o vuelve al mosaico para elegir otra
          región.
        </div>
      )}
      {frame && frame.coverage < 0.995 && (
        <span className="region-coverage">
          {Math.round(frame.coverage * 100)}% de cobertura · área restante sin datos
        </span>
      )}
    </div>
  );
}
