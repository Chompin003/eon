# Cómo está construido y qué se tomó de las referencias

Estado: 14 de noviembre de 2026. Proyecto independiente del equipo; los datos proceden de NASA/SPHEREx y Caltech/IPAC IRSA.

## De la primera versión a los datos reales

1. La primera versión usaba React/TypeScript/Vite para la aplicación y una esfera Three.js con checkerboard generado por un shader. Permitió probar navegación, zoom, controles táctiles y trabajo por módulos sin inventar imágenes científicas.
2. Se simplificó la interfaz: cielo a pantalla completa y una flecha que abre la ventana móvil/redimensionable con `react-rnd`. Se mantienen los slots `coordinateTools` y `drawingTools`.
3. Iván/GorditoG implementó el formulario RA h:m:s / Dec ±d:m:s. Se conserva su módulo: convierte a grados y cambia el centro manteniendo el zoom, incluido el signo de declinaciones como −00°15′30″. Ahora el visor admite los polos ±90°.
4. Se prepararon GitHub y Cloudflare Pages. Cada push de un colaborador autorizado crea/actualiza un PR; se integra automáticamente después de `quality` y `Cloudflare Pages`. Los borradores, conflictos y checks fallidos detienen la integración. La URL de producción permanece igual. No hay aprobación humana obligatoria.
5. Se instaló Python 3.13 + Astroquery/Astropy y dependencias en `.venv`; los requisitos están fijados. Python es una herramienta científica local, no se introduce dentro del navegador.
6. El visor de producción usa ahora **Aladin Lite 3.8.2**, mantenido por CDS, para interpretar los mosaicos HiPS/HEALPix y las imágenes FITS con WCS. Three.js queda como referencia de desarrollo, cargada solo bajo demanda. El pequeño adaptador `viewer/sip.ts` cubre una incompatibilidad que el motor no resuelve; sus transformaciones se contrastan contra Astropy/WCSLIB y su interpolación contra SciPy.

## Dos productos de SPHEREx, con funciones distintas

**Mosaico espectral DR1.** El navegador lee las propiedades y teselas PNG directamente de [IRSA](https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube/properties), siguiendo el [notebook oficial de HiPS](https://caltech-ipac.github.io/irsa-tutorials/spherex-hipscube/). La proyección ecuatorial corresponde a coordenadas reales del cielo. No son fotos de luz visible ni imágenes generadas por IA.

El cubo contiene 102 canales en longitud de onda creciente, repartidos en seis detectores y 17 canales por detector. Se omiten las capas vacías 50 y 51 documentadas por IRSA: quedan 100 selecciones útiles. Las longitudes de onda se leen del archivo oficial de propiedades, sin inventar una separación uniforme. Inicialmente A = 3.293 µm y B = 4.405 µm. El producto actual combina observaciones de 2025-04-24 a 2026-05-14; su publicación es 2026-11-01. Esas fechas describen el producto, no una época seleccionable.

Se puede ver A en B/N, superponer B al 50%, combinar A rojo + B azul como **color falso**, o dividir la pantalla entre B/N y color con centro y FOV horizontal compartidos. La escala del mosaico es aproximadamente 12.88″/píxel. El zoom hasta 1″ amplía los píxeles existentes y no inventa detalle. Algunos canales muestran franjas: IRSA documenta artefactos del mosaico cerca de líneas de emisión intensas.

**Exposiciones individuales.** «Buscar exposiciones aquí» consulta el servicio SIA v2 de IRSA para la posición actual, con DR1/QR3 y sus campos profundos. Se seleccionan detector y año, se ordenan las imágenes por `t_min` y se muestran año grande, fecha/hora UTC y colección. `t_min` es MJD de observación; no se usa la fecha de procesamiento `DATE` como si fuese la de captura.

«Ver exposición» solicita un recorte de 0.1°: las Functions de Pages consultan únicamente el archivo oficial y devuelven únicamente la extensión calibrada **IMAGE**, conservando sus píxeles, unidades MJy/sr y tarjetas WCS/SIP. FLAGS, VARIANCE y ZODI no se muestran como si fueran señal. Para dibujar la exposición se corrige SIP en una copia visual mediante interpolación bilineal y se deja la proyección TAN a Aladin. El lector SIP de Aladin 3.8.2 no interpreta correctamente estos recortes; se comprobó este fallo contra Astropy antes de publicar. La descarga conserva los píxeles y WCS/SIP originales; la copia visual no se debe usar para fotometría. Fuera del pequeño recorte no hay imagen: para otra región, cambia de coordenadas y repite la búsqueda. «Volver al mosaico» recupera la exploración del cielo.

Las fechas reales se recorren con slider y reproducción de 100–2000 ms. El intervalo es un mínimo: se espera a que la imagen se cargue antes de avanzar. En una exposición, «Color» utiliza pseudocolor viridis de esa misma imagen; en el mosaico combina dos canales. La longitud de onda en una exposición depende de la posición sobre el filtro variable del detector. Por ello el parpadeo de exposiciones de un detector **no garantiza comparación fotométrica a la misma longitud de onda** ni prueba por sí solo movimiento o variabilidad. Para eso faltan selección espectral equivalente, homogeneización de PSF y análisis de calidad.

## Qué se usó del documento del equipo

Documento: [E-Star Documentation](https://docs.google.com/document/d/159sdeV38skKriQqp0xtZTA1YNfZYdF8qQIfoH7sSTW4/edit).

| Recurso del documento                                             | Uso efectivo                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three.js                                                          | Motor del primer checkerboard. Se conserva para pruebas de referencia; Aladin interpreta las imágenes científicas actuales.                                                                                           |
| RA/Dec, convención INCON y conversor Swift                        | Requisitos para el módulo de coordenadas desarrollado por Iván. No se copió ciegamente el ejemplo Python: su tratamiento de −00° pierde el signo; el módulo TypeScript lo conserva.                                   |
| IRSA eon                                             | Archivo oficial, productos, procedencia y documentación de imágenes. No se extraen capturas de su interfaz.                                                                                                           |
| Astroquery                                                        | Instalación reproducible y consulta científica de exposiciones mediante `query_sia`; script `tools/astronomy/query_spherex.py` para contrastar metadatos y WCS con Astropy.                                           |
| IVOA Simple Image Access                                          | Protocolo real utilizado por el backend para descubrir imágenes por posición/año. La aplicación usa la misma API HTTP, sin necesitar un proceso Python permanente.                                                    |
| TheSkyLive, Betelgeuse, Barnard, Epsilon Indi / Exoplanet Archive | Referencias consultadas; no son la fuente de imágenes SPHEREx ni un catálogo importado a la aplicación. La fila de Barnard del documento repite coordenadas de Betelgeuse: no se convirtió en una fixture científica. |

Se consultaron también los recursos del challenge y WISE View para navegación y parpadeo. **Aladin Lite** procede de CDS y de las referencias astronómicas del challenge; no se atribuye al documento como si ya estuviera listado allí. Los notebooks oficiales de IRSA aportaron la URL exacta del cubo, correspondencia de canales, exclusión de canales vacíos, acceso SIA y recortes FITS. React, Vite, TypeScript, `react-rnd`, pruebas y automatización son infraestructura de la aplicación añadida por nosotros. No se ha integrado Paint.

## ¿Es buena idea Astroquery?

Sí para buscar productos, consultar tablas y preparar/verificar datos en Python. Es open source, trabaja con Astropy y aparece en los ejemplos oficiales de IRSA. No almacena «todos los PNG», no dibuja una esfera y no mantiene una suscripción que actualice la web automáticamente.

La arquitectura actual evita mantener un servidor Python para cada movimiento del cielo: **Aladin + HiPS** en el navegador; **SIA/recortes IRSA** mediante dos endpoints de Pages; **Astroquery/Astropy** para consultas reproducibles y verificación científica. IRSA publica nuevas exposiciones periódicamente; una nueva búsqueda consulta el archivo (caché HTTP de cinco minutos). Al abrir la página se revalida el archivo de propiedades del mosaico. Una nueva publicación de IRSA no implica que el mosaico se regenere en ese mismo instante.

El resultado SIA se limita a 2000 filas por consulta. Si IRSA informa truncamiento, la interfaz lo advierte y permite filtrar por año; no presenta esa selección como historial completo. No existen datos SPHEREx anteriores al comienzo de la misión en 2025. Esta vista es de exploración, no sustituye las herramientas de fotometría científicas de IRSA.

## Implementación para los compañeros

- `src/shared/contracts.ts`: `ViewState` mantiene RA/Dec en grados, latitud ±90° y FOV **horizontal**, no vertical. `SkySource` admite `hips`, `fits` y la referencia `checkerboard`. `DisplayMode` es `mono`, `color` o `split`.
- `src/viewer/skyFrame.ts`: adaptación fijada a Aladin 3.8.2. Sus capas del mismo `creator_did` comparten cursor espectral; el adaptador distingue las claves de caché en memoria. La selección de archivo compensa `hips_cube_firstframe=1` y la interpolación interna en frecuencia. Estas dos decisiones requieren revisar pruebas de solicitudes si se actualiza Aladin. El gesto de pellizco usa su API de FOV para conservar el norte arriba, porque el motor desactiva su gesto nativo con esa opción.
- Cada panel del cielo vive en un documento `sky.html` aislado. Sus mensajes comprueban origen y ventana emisora. Retirar el iframe libera el contexto WebGL, WASM y eventos; cambiar exposición retira el documento anterior y evita imágenes tardías de una fecha anterior.
- `src/data/ObservationsPanel.tsx`: conserva consulta, detector, fecha e intervalo al cerrar la ventana. El slider de fechas no altera los canales del mosaico.
- `functions/api/{observations,cutout}.ts`: sin credenciales; hosts y rutas permitidas fijos, tamaños y tiempos acotados, reintentos de errores transitorios. `server/irsa.ts` extrae los bloques IMAGE sin reproyectar ni modificar la señal.
- `coordinateTools`, `CoordinateToolsProps` y `drawingTools` continúan disponibles. Paint deberá proyectar anotaciones con el WCS del visor; no reutilizar posiciones de pantalla como si fueran RA/Dec.

## Reproducir y comprobar

```sh
npm ci
npm run dev:full
```

Esto construye Vite y sirve frontend + Functions en `http://localhost:8788`. `npm run dev` conserva el servidor rápido de frontend; las búsquedas de exposiciones necesitan las Functions. No se requieren cuentas de IRSA ni claves privadas.

```powershell
.\.venv\Scripts\python.exe tools/astronomy/query_spherex.py --verify-first
```

El script consulta IRSA realmente, guarda el manifiesto bajo `data-cache` y contrasta el recorte con Astropy. Los tests de interfaz usan propiedades, tres exposiciones FITS y teselas oficiales guardadas con procedencia en `tests/fixtures/spherex`. Para que CI sea independiente de IRSA se repite una tesela por canal: esa prueba sirve para controles, no valida el contenido científico de todo el cielo. La carga real se comprueba por separado contra IRSA y en producción.

Fuentes primarias adicionales: [Aladin Lite, código y licencia](https://github.com/cds-astro/aladin-lite/tree/v3.8.2), [Astroquery IRSA](https://docs.astropy.org/projects/astroquery/en/stable/ipac/irsa/irsa.html), [notebook de imágenes espectrales](https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/), [notebook de recortes](https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts/).
