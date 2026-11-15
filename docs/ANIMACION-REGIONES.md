# Animación de regiones

Implementación coordinada en el PR de `codex/region-flipbook`.

## Contratos y composición

- `SkyRegion` describe centro ICRS y lado angular en grados (0.02–0.25°).
- `FITSSource.sequence.region` activa el reproductor de región. La ruta anterior queda compatible para fuentes sin región.
- `BufferStatus` añade identificadores listos/fallidos y cobertura del cuadro actual. El panel puede reproducir los disponibles y señalar fechas faltantes.
- App compone la selección gráfica del visor y las herramientas de tiempo. No cambia `ViewState`, `CoordinateToolsProps`, `coordinateTools`, `drawingTools` ni la API de `SkyProjection` utilizada por Paint.

## Datos y representación

La navegación HiPS sigue en Aladin. El modo temporal registra las exposiciones en una cuadrícula TAN común orientada al norte, con inversión TAN-SIP y muestreo bilineal en un Web Worker. La proyección de esta cuadrícula se contrasta con Astropy/WCSLIB; sus máscaras mantienen los píxeles sin cobertura transparentes. Las descargas FITS originales permanecen sin modificar.

Canvas 2D presenta los cuadros preparados sin crear una capa WebGL por fecha. Comparación y Paint usan la misma región y transformaciones de coordenadas. Cambiar pan/zoom transforma la vista de esa cuadrícula; no solicita datos fuera de ella. Para otra zona se selecciona una región nueva en HiPS.

La caché de regiones permanece en el navegador, con presupuesto y expulsión de entradas antiguas. No se habilita almacenamiento facturable ni se copia el archivo completo de SPHEREx. Los reintentos conservan cuadros preparados. La reproducción automática comienza con cuadros disponibles, mostrando avance, errores y fechas omitidas; ningún fallo se sustituye por imágenes inventadas.

## Verificación prevista

Astropy/SciPy como referencia independiente; fixtures oficiales de IRSA para pruebas repetibles; navegación, coordenadas, Paint, pantalla dividida, selección táctil/teclado, carga parcial, reintento, caché y mediciones de dos bucles sin solicitudes FITS adicionales. Comprobar datos reales y despliegue antes de entregar.

Referencia del patrón de reproducción: [WISE View, canvas y caché de cuadros](https://github.com/backyardworlds/wiseview/blob/master/wv/www/static/flash3.js). Se reutiliza el patrón, no sus constantes de píxel ni su calibración WISE para datos SPHEREx.
