# Arquitectura y contratos

```text
src/
  App.tsx              Composición y estado compartido
  viewer/              Three.js, esfera interior y entradas de navegación
  data/                Proveedor local; futuros proveedores astronómicos
  drawing/             Contrato preparado para futuras anotaciones
  ui/                  Paneles, controles, accesibilidad y estilos
  shared/              Contratos y límites, sin dependencias de otros módulos
```

## Dependencias permitidas

`App.tsx` conecta las API públicas (`index.ts`) de los módulos. Cada módulo importa tipos/constantes de `shared`, nunca de un módulo hermano. ESLint verifica esta frontera. El punto de entrada solo monta React e importa estilos. No hay dependencias circulares.

| Contrato        | Responsabilidad                                                                       |
| --------------- | ------------------------------------------------------------------------------------- |
| `ViewState`     | Longitud `[0, 360)`, latitud `[-85, 85]`, campo de visión vertical `[25, 100]` grados |
| `ViewerLayers`  | Activación de la cuadrícula y puntos decorativos de referencia                        |
| `SkySource`     | Unión discriminada; por ahora solo `CheckerboardSource` con filas y columnas          |
| `SkyAnnotation` | Forma de anotaciones futuras; no hay herramientas activas todavía                     |
| `normalizeView` | Protege límites, envoltura longitudinal y valores no finitos                          |

Las coordenadas son de una esfera sintética y no están calibradas como observaciones científicas. El zoom mostrado es `100 / fov`, relativo a la vista más amplia, no una magnificación científica.

## Visor

`SkyViewer` recibe `source`, `view`, `layers` y `onViewChange`. La cámara está fija en el origen; una malla esférica de radio 50 se dibuja por sus caras internas (`BackSide`). Un shader genera el checkerboard y las marcas decorativas sin solicitudes de datos. El usuario rota la dirección de la cámara, nunca su posición.

Los cambios de vista no recrean la escena. `ResizeObserver` ajusta proporción y tamaño; la densidad de píxeles se limita a 2. Un bucle `requestAnimationFrame` dibuja cuando cambia la vista, las capas o el tamaño; las vistas inmóviles y pestañas ocultas omiten el trabajo de GPU. Al desmontar se liberan animation frames, eventos, geometría, material y renderer; es compatible con React StrictMode. La pérdida de contexto WebGL muestra un aviso y su recuperación restaura la vista.

Mouse y un dedo desplazan la dirección; rueda y dos dedos cambian FOV. Flechas navegan, `+`/`-` acercan/alejan y `Home` restablece. No se cargan imágenes SPHEREx ni modelos de IA.

## Incorporar un proveedor real en el futuro

1. Acuerda una nueva variante de `SkySource` en un PR de contratos; especifica proyección, coordenadas, licencia, carga y errores.
2. Implementa la lectura/caché en `data/`, con secretos exclusivamente en backend si fueran necesarios. Las variables `VITE_*` son públicas.
3. Implementa la estrategia de textura en `viewer/` manteniendo la misma API de navegación.
4. Conecta el proveedor en `App.tsx`; la UI solo recibe metadatos y estados a través de contratos.

No añadas ahora estas funciones: el objetivo de esta entrega es validar la infraestructura y la navegación.

## Dependencias y pruebas

Las versiones exactas están fijadas en `package.json` y `package-lock.json`. Se usa Node 24.11.1 para alinear desarrollo, CI y Pages. Las tipografías DM Sans y Space Grotesk se sirven localmente mediante Fontsource; el visor no depende de Google Fonts ni APIs externas.

El override de `minimatch` a `11.0.1` en `@typescript-eslint/typescript-estree` corrige el aviso [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249); se verifica con ESLint y `npm audit`. Retirarlo cuando la dependencia transitiva ya incorpore una versión corregida.

`npm run check` valida TypeScript, lint y fronteras de módulos. `npm test` comprueba límites y matemática de navegación. Después de `npm run build`, `npm run test:e2e` sirve la compilación de producción con Vite Preview y usa Chromium/Playwright para probar WebGL, arrastre, zoom, reinicio, teclado, capas y gestos táctiles en 390 px. Para la primera ejecución: `npx playwright install chromium`. CI instala Chromium con sus dependencias Linux antes de ejecutar las mismas pruebas. `npm run format` aplica el formato compartido y `npm run format:check` lo verifica.
