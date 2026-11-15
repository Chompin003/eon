import { useEffect, useState } from 'react';
import type { SkyProjection } from '../shared';
import { angularScale } from './angularScaleMetrics';
export function AngularScale({ projection }: { projection: SkyProjection }) {
  const [, redraw] = useState(0);
  useEffect(() => projection.subscribe(() => redraw((n) => n + 1)), [projection]);
  const scale = angularScale(projection);
  if (!scale) return null;
  const { width, height, x, y, pixels, label, seconds } = scale;
  return (
    <svg
      className="angular-scale"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Escala angular: ${label.replace('′', ' minutos de arco').replace('″', ' segundos de arco')}`}
      data-arcsec={seconds}
      data-width={pixels}
    >
      <rect
        x={x - pixels - 9}
        y={y - 26}
        width={pixels + 18}
        height={40}
        rx="3"
        fill="#111"
        fillOpacity=".8"
        stroke="none"
      />
      <path d={`M${x - pixels} ${y - 5}v7H${x}v-7`} fill="none" stroke="white" strokeWidth="2" />
      <text
        x={x - pixels / 2}
        y={y - 10}
        textAnchor="middle"
        fill="white"
        stroke="none"
        fontSize="12"
        fontFamily="sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
