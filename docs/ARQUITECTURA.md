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

## Reproductor de regiones (sustituye la ruta temporal de capas Aladin)

`FITSSource.sequence.region` activa `TimelapseViewer` y `RegionCanvas`. La ruta anterior continúa disponible para fuentes sin región. `SkyRegion` fija centro ICRS y lado de 0.02–0.25°. `RegionSelector` usa la proyección real de Aladin para convertir el cuadrado dibujado a coordenadas. App compone estos callbacks con los controles.

`registerFits` interpreta PC/CDELT o CD, invierte TAN-SIP y remuestrea una sola vez la señal a una cuadrícula norte-arriba común. Se verifica contra Astropy/WCSLIB y SciPy, con fixtures oficiales. El render de cada época consiste en un `drawImage` de Canvas 2D; no se mantienen capas FITS/WebGL por fecha. `SkyProjection` conserva su API para Paint; el campo horizontal se mantiene angularmente correcto al desplazar la cámara dentro de la cuadrícula.

`RegionBuffer` prepara tres exposiciones en paralelo, empieza a reproducir con las disponibles, reintenta solo fallos recuperables y publica identificadores y razones de fechas no disponibles. La consulta SIA usa un círculo que contiene el cuadrado: algunos candidatos pueden no tener píxeles válidos en él; se identifican como ausencia de cobertura, se cachean y no se reintentan como fallos de red. La barra mide preparación terminada, no inventa cobertura ni cuadros.

La caché de copias registradas tiene presupuestos independientes de 96 MB en memoria y 96 MB en IndexedDB, con expulsión LRU. Cada panel limita a 16 MB sus imágenes de visualización. IndexedDB es opcional; si el navegador no permite guardar, la animación funciona en memoria. No hay servicios de pago. `streamedImageHdu` cancela la transferencia de IRSA al terminar IMAGE para no descargar la PSF completa ni las extensiones que no se muestran.

Detalles y mediciones nuevas en [ANIMACION-REGIONES.md](ANIMACION-REGIONES.md).
