import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const available = () => ({
  width: Math.max(1, window.innerWidth - 24),
  height: Math.max(1, window.innerHeight - 24),
});

function keepVisible(rect: PanelRect): PanelRect {
  const bounds = available();
  const width = Math.min(bounds.width, Math.max(Math.min(280, bounds.width), rect.width));
  const height = Math.min(bounds.height, Math.max(Math.min(300, bounds.height), rect.height));
  return {
    width,
    height,
    x: Math.max(0, Math.min(bounds.width - width, rect.x)),
    y: Math.max(0, Math.min(bounds.height - height, rect.y)),
  };
}

/** Non-modal tool window; canvas interaction remains available outside its bounds. */
export function FloatingPanel({
  open,
  onClose,
  observationDate,
  children,
}: {
  open: boolean;
  onClose: () => void;
  observationDate?: string;
  children: ReactNode;
}) {
  const [rect, setRect] = useState(() => keepVisible({ x: 44, y: 44, width: 356, height: 680 }));
  const titleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const resize = () => setRect((current) => keepVisible(current));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (open) titleRef.current?.focus({ preventScroll: true });
  }, [open]);

  const keyboard = (event: KeyboardEvent, resize: boolean) => {
    const changes: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const change = changes[event.key];
    if (!change) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    setRect((current) =>
      keepVisible(
        resize
          ? {
              ...current,
              width: current.width + change[0] * step,
              height: current.height + change[1] * step,
            }
          : { ...current, x: current.x + change[0] * step, y: current.y + change[1] * step },
      ),
    );
  };

  return (
    <div
      className="panel-stage"
      aria-hidden={!open}
      style={{ visibility: open ? 'visible' : 'hidden' }}
      inert={!open}
    >
      <Rnd
        className="floating-panel"
        size={{ width: rect.width, height: rect.height }}
        position={{ x: rect.x, y: rect.y }}
        bounds="parent"
        minWidth={Math.min(280, available().width)}
        minHeight={Math.min(300, available().height)}
        maxWidth={available().width}
        maxHeight={available().height}
        dragHandleClassName="window-drag-handle"
        onDragStop={(_, data) =>
          setRect((current) => keepVisible({ ...current, x: data.x, y: data.y }))
        }
        onResizeStop={(_, __, element, ___, position) =>
          setRect(
            keepVisible({
              ...position,
              width: element.offsetWidth,
              height: element.offsetHeight,
            }),
          )
        }
        resizeHandleComponent={{
          bottomRight: (
            <button
              className="resize-grip"
              aria-label="Cambiar tamaño del panel"
              title="Arrastra para cambiar tamaño. Flechas con el teclado."
              onKeyDown={(e) => keyboard(e, true)}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 13 9-9M9 13l4-4" />
              </svg>
            </button>
          ),
        }}
      >
        <div
          id="viewer-controls"
          className="panel-inner"
          role="dialog"
          aria-modal="false"
          aria-label="Controles del visor"
        >
          <div className="window-titlebar">
            <div
              ref={titleRef}
              className="window-drag-handle"
              role="button"
              tabIndex={0}
              aria-label="Mover panel"
              title="Arrastra para mover. Flechas con el teclado."
              onKeyDown={(e) => keyboard(e, false)}
            >
              <span className="drag-dots" aria-hidden="true">
                ⠿
              </span>
              <span>Controles</span>
              {observationDate && (
                <time
                  className="panel-observation-date"
                  dateTime={observationDate}
                  title="Exposición seleccionada · UTC"
                >
                  {observationDate.slice(0, 4)} · {observationDate.slice(5, 10)}
                </time>
              )}
            </div>
            <button
              className="close-panel"
              onClick={onClose}
              aria-label="Cerrar controles"
              title="Cerrar · Esc"
            >
              ×
            </button>
          </div>
          <div className="panel-content">{children}</div>
        </div>
      </Rnd>
    </div>
  );
}
