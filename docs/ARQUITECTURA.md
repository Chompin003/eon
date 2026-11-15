# Arquitectura y contratos actuales

La composición se mantiene en `App.tsx`: `viewer`, `data`, `ui` y `drawing` se comunican mediante `shared` y sus API públicas `index.ts`; no importan módulos hermanos. ESLint conserva esa frontera.

| Contrato                         | Semántica                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ViewState`                      | RA `[0,360)`, Dec `[-90,90]`, FOV **horizontal** `[1/3600,100]` en grados. Marco ICRS, referencia J2000.        |
| `SkySource`                      | Unión `hips`, `fits`, `archive-hips`, `checkerboard`. La última es una referencia de desarrollo.                |
| `HiPSSource.frame`               | Índice espectral cero-basado. No es una época.                                                                  |
| `Observation`                    | URL oficial, detector, colección, `mjd` y fecha/hora UTC obtenidos de SIA.                                      |
| `DisplayMode`                    | `mono`, `color`, `split`. Los paneles comparten `ViewState`.                                                    |
| `CoordinateToolsProps`           | Contrato de Iván sin cambios: `view`, `onViewChange`; conserva zoom.                                            |
| `SkyProjection` / `drawingTools` | Paint usa la proyección del motor para anclar anotaciones al cielo.                                             |
| `FITSSource.sequence`            | Identificador estable, lista de `FITSFrame` y número de reintento; cambiar fecha no cambia el documento.        |
| `BufferStatus`                   | Secuencia, cuadros preparados/listos/fallidos, bytes y error; App comunica el progreso entre visor y controles. |

`SkyViewer` utiliza Aladin Lite dentro de documentos `sky.html` aislados. El padre mantiene React y la ventana flotante; cada documento posee WASM/WebGL, eventos, proyección y capas. Al desmontar el documento se liberan todos sus recursos. Una secuencia conserva el mismo documento y sus capas preparadas; los mensajes de otra secuencia se descartan. El checkerboard Three.js se carga bajo demanda. El panel comparativo puede mostrar pseudocolor del mismo FITS o un mosaico Hubble/Webb independiente, sin afectar la precarga de SPHEREx.

Las teselas y propiedades del mosaico llegan directamente de IRSA. Las Functions `api/observations` y `api/cutout` consultan SIA y recortes de IRSA desde el mismo origen de la aplicación. No hay Python persistente, base de datos, tokens ni datos inventados. `server/irsa.ts` contiene validación, lecturas limitadas y extracción del HDU IMAGE.

Para los FITS SPHEREx TAN-SIP, el adaptador de visualización `viewer/sip.ts` crea una copia de imagen con la distorsión corregida por interpolación bilineal, manteniendo el TAN para el motor. Es un ajuste de compatibilidad con Aladin 3.8.2; la descarga del FITS científico conserva píxeles y WCS/SIP originales. El adaptador se contrasta con Astropy/WCSLIB y SciPy. No usar la copia visual para fotometría.

`FloatingPanel` conserva geometría y módulos aunque se cierre. `ObservationsPanel` posee búsqueda, detector, fecha e intervalo. Reproducir se habilita cuando todos los cuadros están preparados en los paneles necesarios; el temporizador alterna capas desde memoria. `FrameBuffer` descarga con concurrencia tres y `fitsWorker` corrige SIP fuera del hilo de interfaz. El límite de copias visuales es 96 MB por selección y 96 MB de caché LRU; las capas WebGL añaden memoria por panel. Cambiar selección cancela las descargas anteriores. El módulo de coordenadas de Iván se monta en `coordinateTools`; Paint sigue en `drawingTools`.

`ImageReadiness` comunica la presentación del cuadro mediante suscripción. Solo la línea temporal se suscribe: una confirmación del motor no vuelve a renderizar todos los controles de App. Si el renderizado tarda más que el intervalo, la reproducción espera esa confirmación antes de avanzar; no salta fechas para aparentar más velocidad.

Detalles, fuentes, límites y herramientas del documento del equipo: [COMO-FUNCIONA.md](COMO-FUNCIONA.md).
