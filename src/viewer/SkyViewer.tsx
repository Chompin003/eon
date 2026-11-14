import { useEffect, useRef, useState } from 'react';
import {
  Mesh,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  SRGBColorSpace,
} from 'three';
import {
  DEFAULT_VIEW,
  normalizeView,
  type SkySource,
  type ViewerLayers,
  type ViewState,
} from '../shared';
import { createCheckerboard } from './checkerboard';
import { panView, wheelZoomFactor, zoomView } from './navigation';

interface Props {
  source: SkySource;
  view: ViewState;
  layers: ViewerLayers;
  onViewChange: (view: ViewState) => void;
}

export function SkyViewer({ source, view, layers, onViewChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const current = useRef({ view, layers, onViewChange });
  const [error, setError] = useState<string | null>(null);

  // Keep external state current without rebuilding GPU resources or input listeners.
  useEffect(() => {
    current.current = { view, layers, onViewChange };
  }, [view, layers, onViewChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setError('No se pudo iniciar WebGL2. Activa la aceleración gráfica o prueba otro navegador.');
      return;
    }

    const canvas = renderer.domElement;
    setError(null);
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Esfera celeste interactiva');
    canvas.setAttribute('aria-describedby', 'navigation-help');
    host.appendChild(canvas);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new Scene();
    const camera = new PerspectiveCamera(current.current.view.fov, 1, 0.1, 120);
    // Camera remains at the origin, inside a back-face-rendered celestial sphere.
    camera.position.set(0, 0, 0);
    const geometry = new SphereGeometry(50, 96, 64);
    const material = createCheckerboard(source, current.current.layers);
    scene.add(new Mesh(geometry, material));
    const direction = new Vector3();
    let frame = 0;
    let disposed = false;
    let contextLost = false;
    let dirty = true;
    let renderedView: ViewState | undefined;
    let renderedLayers: ViewerLayers | undefined;

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const updateView = (next: ViewState) => {
      current.current.view = normalizeView(next);
      current.current.onViewChange(current.current.view);
    };
    const pointers = new Map<number, { x: number; y: number }>();
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.classList.add('is-dragging');
    };
    const pointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      if (pointers.size === 1) {
        updateView(
          panView(
            current.current.view,
            event.clientX - previous.x,
            event.clientY - previous.y,
            host.clientHeight,
          ),
        );
      } else if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 0 && after > 0) updateView(zoomView(current.current.view, before / after));
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) canvas.classList.remove('is-dragging');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      updateView(
        zoomView(
          current.current.view,
          wheelZoomFactor(event.deltaY, event.deltaMode, host.clientHeight),
        ),
      );
    };
    const keyDown = (event: KeyboardEvent) => {
      const active = current.current.view;
      const step = active.fov / (event.shiftKey ? 7.5 : 25);
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      if (directions[event.key]) {
        event.preventDefault();
        const [longitude, latitude] = directions[event.key];
        updateView({
          ...active,
          longitude: active.longitude + longitude,
          latitude: active.latitude + latitude,
        });
      } else if (['+', '=', '-', 'Home'].includes(event.key)) {
        event.preventDefault();
        updateView(
          event.key === 'Home'
            ? { ...DEFAULT_VIEW }
            : zoomView(active, event.key === '-' ? 1.1 : 1 / 1.1),
        );
      }
    };
    const loseContext = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      setError('Se interrumpió la sesión gráfica. Esperando a que el navegador la recupere…');
    };
    const restoreContext = () => {
      contextLost = false;
      setError(null);
      resize();
    };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('lostpointercapture', pointerUp);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('webglcontextlost', loseContext);
    canvas.addEventListener('webglcontextrestored', restoreContext);

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (document.hidden || contextLost) return;
      const { view: active, layers: activeLayers } = current.current;
      if (!dirty && active === renderedView && activeLayers === renderedLayers) return;
      dirty = false;
      renderedView = active;
      renderedLayers = activeLayers;
      const longitude = (active.longitude * Math.PI) / 180;
      const latitude = (active.latitude * Math.PI) / 180;
      direction.set(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      );
      camera.lookAt(direction);
      if (camera.fov !== active.fov) {
        camera.fov = active.fov;
        camera.updateProjectionMatrix();
      }
      material.uniforms.uGrid.value = activeLayers.grid ? 1 : 0;
      material.uniforms.uStars.value = activeLayers.stars ? 1 : 0;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('webglcontextlost', loseContext);
      canvas.removeEventListener('webglcontextrestored', restoreContext);
      pointers.clear();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [source]);

  return (
    <div className="sky-canvas" ref={hostRef}>
      {error && (
        <div className="viewer-error" role="alert">
          <strong>Vista no disponible</strong>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
