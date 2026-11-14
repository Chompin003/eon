# SPHEREx Explorer

Prototipo web para NASA Space Apps Challenge: una esfera celeste 3D con checkerboard procedural, navegación desde su interior y controles accesibles. No contiene imágenes ni datos científicos reales y no es un producto oficial de NASA.

## Desarrollo local

Requiere Node.js 24 LTS, npm y Git.

```sh
npm ci
npm run dev
```

Abre la dirección que imprime Vite. `npm run dev -- --host 0.0.0.0` permite probar en un teléfono de tu red local.

```sh
npm run check
npm test
npm run build
npm run preview
```

## Equipo

Lee [la guía de colaboración](docs/COLABORACION.md), [los contratos de módulos](docs/ARQUITECTURA.md) y [AGENTS.md](AGENTS.md). Cada desarrollador usa su computadora, cuenta y sesión de IA. Live Share sirve para sesiones conjuntas; Git y Pull Requests integran el trabajo independiente.

| Rama | Responsabilidad |
| --- | --- |
| `main` | Versión integrada para producción |
| `feat/sky-viewer` | Esfera, cámara, controles y WebGL |
| `feat/spherex-data` | Proveedores de datos y coordenadas |
| `feat/drawing-tools` | Selección y futuras anotaciones |
| `feat/interface` | Interfaz, controles y estilos |

## Despliegue

Cloudflare Pages: `main`, `npm run build`, salida `dist`, Node `24.11.1`. Configuración y verificación en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md). La existencia de los archivos de CI no confirma que un despliegue remoto se haya ejecutado; comprueba los estados en GitHub y Cloudflare.

Tecnologías: React, TypeScript, Vite y Three.js. Licencia MIT.
