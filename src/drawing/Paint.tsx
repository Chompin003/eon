import { useEffect, useRef, useState } from 'react';
import type { SkyProjection } from '../shared';
import { createPaintController, type PaintController } from './paint-controller.js';
import './paint.css';

/** One session shared by controls and every visible projection/pane. */
export function usePaintSession() {
  const [session] = useState(createPaintController);
  return session;
}

export function PaintTools({ session }: { session: PaintController }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    host.current?.append(session);
    return () => {
      session.remove();
    };
  }, [session]);
  return <div ref={host} className="paint-controls" />;
}

export function PaintSurface({
  session,
  projection,
}: {
  session: PaintController;
  projection: SkyProjection;
}) {
  const board = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (board.current) return session.attachSurface(board.current, projection);
  }, [session, projection]);
  return (
    <svg
      ref={board}
      className="study-annotations"
      xmlns="http://www.w3.org/2000/svg"
      role="application"
      aria-label="Anotaciones de estudio: dibuja sobre SPHEREx"
    />
  );
}
