# Arquitectura y contratos actuales

La composición se mantiene en `App.tsx`: `viewer`, `data`, `ui` y `drawing` se comunican mediante `shared` y sus API públicas `index.ts`; no importan módulos hermanos. ESLint conserva esa frontera.

| Contrato                         | Semántica                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ViewState`                      | RA `[0,360)`, Dec `[-90,90]`, FOV **horizontal** `[1/3600,100]` en grados. Marco ICRS, referencia J2000. |
| `SkySource`                      | Unión `hips`, `fits`, `checkerboard`. La última es una referencia de desarrollo.                         |
| `HiPSSource.frame`               | Índice espectral cero-basado. No es una época.                                                           |
| `Observation`                    | URL oficial, detector, colección, `mjd` y fecha/hora UTC obtenidos de SIA.                               |
| `DisplayMode`                    | `mono`, `color`, `split`. Los paneles comparten `ViewState`.                                             |
| `CoordinateToolsProps`           | Contrato de Iván sin cambios: `view`, `onViewChange`; conserva zoom.                                     |
| `SkyAnnotation` / `drawingTools` | Reservados para Paint; no hay implementación de dibujo.                                                  |

`SkyViewer` utiliza Aladin Lite dentro de documentos `sky.html` aislados. El padre mantiene React y la ventana flotante; cada documento posee WASM/WebGL, eventos, proyección y capas. Al desmontar el documento se liberan todos sus recursos. Las exposiciones distintas usan documentos distintos, evitando que una respuesta tardía cambie la fecha visible. El checkerboard Three.js se carga bajo demanda.

Las teselas y propiedades del mosaico llegan directamente de IRSA. Las Functions `api/observations` y `api/cutout` consultan SIA y recortes de IRSA desde el mismo origen de la aplicación. No hay Python persistente, base de datos, tokens ni datos inventados. `server/irsa.ts` contiene validación, lecturas limitadas y extracción del HDU IMAGE.

Para los FITS SPHEREx TAN-SIP, el adaptador de visualización `viewer/sip.ts` crea una copia de imagen con la distorsión corregida por interpolación bilineal, manteniendo el TAN para el motor. Es un ajuste de compatibilidad con Aladin 3.8.2; la descarga del FITS científico conserva píxeles y WCS/SIP originales. El adaptador se contrasta con Astropy/WCSLIB y SciPy. No usar la copia visual para fotometría.

`FloatingPanel` conserva geometría y módulos aunque se cierre. El componente `ObservationsPanel` posee búsqueda, detector, fecha e intervalo mínimo; espera la carga de cada FITS antes de avanzar. El módulo de coordenadas de Iván se monta en `coordinateTools`; Paint sigue en `drawingTools`.

Detalles, fuentes, límites y herramientas del documento del equipo: [COMO-FUNCIONA.md](COMO-FUNCIONA.md).
