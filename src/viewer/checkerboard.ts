import { BackSide, ShaderMaterial, Vector2 } from 'three';
import type { CheckerboardSource, ViewerLayers } from '../shared';

export function createCheckerboard(source: CheckerboardSource, layers: ViewerLayers) {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      uCells: { value: new Vector2(source.columns, source.rows) },
      uGrid: { value: layers.grid ? 1 : 0 },
      uStars: { value: layers.stars ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec2 uCells;
      uniform float uGrid;
      uniform float uStars;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 cell = vUv * uCells;
        float checker = mod(floor(cell.x) + floor(cell.y), 2.0);
        vec3 color = mix(vec3(0.016, 0.030, 0.050), vec3(0.044, 0.074, 0.104), checker);

        // Derivative-based antialiasing keeps the spherical grid crisp at all FOVs.
        vec2 gridDistance = abs(fract(cell - 0.5) - 0.5) / max(fwidth(cell), vec2(0.00001));
        float grid = 1.0 - min(min(gridDistance.x, gridDistance.y), 1.0);
        color = mix(color, vec3(0.13, 0.22, 0.28), grid * 0.4 * uGrid);

        float equator = 1.0 - smoothstep(0.0, fwidth(vUv.y) * 1.4, abs(vUv.y - 0.5));
        float dash = step(0.28, fract(vUv.x * 180.0));
        color = mix(color, vec3(0.65, 0.35, 0.13), equator * dash * 0.7 * uGrid);

        // Decorative points are seeded procedural marks, never astronomical observations.
        vec2 starUv = vUv * vec2(260.0, 130.0);
        vec2 tile = floor(starUv);
        vec2 point = vec2(hash(tile), hash(tile + 73.0)) * 0.7 + 0.15;
        float distanceToStar = length((fract(starUv) - point) / max(fwidth(starUv), vec2(0.01)));
        float star = (1.0 - smoothstep(0.15, 0.85, distanceToStar)) * step(0.965, hash(tile + 19.0));
        color += star * vec3(0.48, 0.57, 0.65) * uStars;

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
