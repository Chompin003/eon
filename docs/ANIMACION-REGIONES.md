# Animación de regiones

Implementación coordinada en el [PR #14](https://github.com/Chompin003/eon/pull/14).

## Uso

Abre Tiempo y pulsa **Seleccionar región**. Dibuja, mueve y redimensiona el cuadrado; confirma con Enter o **Usar esta región**. Esc cancela y restaura la vista. El modo normal admite 1.2′–15′; **Modo ampliado** desbloquea hasta 60′ con un aviso de mayor espera y memoria. Pulsa **Buscar exposiciones aquí** y **Animar región**. Comienza automáticamente con las fechas preparadas (salvo preferencia de movimiento reducido); pausa, velocidad y slider siguen disponibles. [Detalles del modo ampliado y escala](REGIONES-AMPLIADAS.md).

La región se presenta como un cuadrado, con B/N, pseudocolor o ambas vistas sincronizadas. El año y la fecha UTC permanecen en los controles. Las fechas sin imagen útil o con fallo de descarga se enumeran; solo los errores recuperables ofrecen reintento. Las áreas sin cobertura se muestran vacías y con su porcentaje. Cambiar región requiere volver al mosaico; pan/zoom no inventan datos fuera de la región preparada.

## Contratos y composición

- `SkyRegion` describe centro ICRS y lado angular: 0.02–0.25° normal, hasta 1° con `extended: true` explícito.
- `FITSSource.sequence.region` activa el reproductor de región. La ruta anterior queda compatible para fuentes sin región.
- `BufferStatus` añade identificadores listos/fallidos y las razones de indisponibilidad con su posibilidad de reintento. El panel puede reproducir los disponibles y señalar fechas faltantes; el canvas indica la cobertura del cuadro actual.
- App compone la selección gráfica del visor y las herramientas de tiempo. No cambia `ViewState`, `CoordinateToolsProps`, `coordinateTools`, `drawingTools` ni la API de `SkyProjection` utilizada por Paint.

## Datos y representación

La navegación HiPS sigue en Aladin. El modo temporal registra las exposiciones en una cuadrícula TAN común orientada al norte, con inversión TAN-SIP y muestreo bilineal en un Web Worker. La proyección de esta cuadrícula se contrasta con Astropy/WCSLIB; sus máscaras mantienen los píxeles sin cobertura transparentes. Las descargas FITS originales permanecen sin modificar.

Canvas 2D presenta los cuadros preparados sin crear una capa WebGL por fecha. Comparación y Paint usan la misma región y transformaciones de coordenadas. Cambiar pan/zoom transforma la vista de esa cuadrícula; no solicita datos fuera de ella. Para otra zona se selecciona una región nueva en HiPS.

La caché de regiones permanece en el navegador: 96 MB en memoria y 96 MB en IndexedDB, con expulsión LRU; las imágenes de cada panel tienen un presupuesto adicional de 16 MB normales o 96 MB ampliadas. La última selección gráfica y su modo se recuerdan en localStorage. Si el navegador bloquea almacenamiento, se mantiene la reproducción en memoria. No se habilita almacenamiento facturable ni se copia el archivo completo de SPHEREx. Los reintentos conservan cuadros preparados. La reproducción automática comienza con cuadros disponibles, mostrando avance, errores y fechas omitidas; ningún fallo se sustituye por imágenes inventadas.

El backend solicita un margen de 1.5 veces el lado para cubrir giros del detector. Lee por streaming únicamente hasta terminar IMAGE y cancela el resto, evitando recibir la PSF completa. Los píxeles científicos y WCS/SIP de esa extensión se conservan. La copia de visualización se remuestrea una sola vez; no sirve para fotometría. Todos los cuadros usan el mismo estiramiento visual, calculado a partir del primer cuadro válido.

## Verificación y mediciones

`tools/astronomy/verify_regions.py` genera referencias independientes con Astropy/WCSLIB y SciPy. Los tests contrastan coordenadas, muestreo, máscaras y conservación de originales. Las pruebas de navegador cubren navegación, Paint, pantalla dividida, selección gráfica/teclado, táctil, carga parcial, reintento y persistencia.

En la consulta real de la región inicial (RA 60.8109955°, Dec 51.3404038°, lado 0.1°), SIA devolvió 423 registros y 63 candidatos D4. Se prepararon 61; dos no tienen píxeles válidos dentro del cuadrado. El círculo SIA contiene el cuadrado y puede devolver candidatos fuera de su huella exacta. Esos casos no se presentan como fallos de red ni se rellenan.

Viewport 900×650, intervalo 100 ms: 122 presentaciones de las 61 fechas disponibles dieron mediana 99.9 ms y p95 117.3 ms; cero solicitudes FITS y cero visores WebGL durante el bucle. Primer cuadro en 3.58 s y preparación en 20.36 s. La consulta fue real y se guardó su XML para repetir la medición; los FITS se solicitaron a IRSA mediante Functions locales. No es una garantía de tiempos para todas las regiones, redes o equipos.

La prueba controlada usa tres FITS oficiales, retardo de red artificial de 150 ms y 30 cuadros: mediana 99.9 ms y p95 116.4 ms. Datos en [region-performance.json](region-performance.json). Para repetir: `node --experimental-strip-types scripts/measure-regions.mjs` con el servidor en 4174; las variables `EON_MEASURE_URL`, `EON_LIVE`, `EON_METADATA` y `EON_REPORT` permiten cambiar destino y escenario.

Referencia del patrón de reproducción: [WISE View, canvas y caché de cuadros](https://github.com/backyardworlds/wiseview/blob/master/wv/www/static/flash3.js). Se reutiliza el patrón, no sus constantes de píxel ni su calibración WISE para datos SPHEREx.
