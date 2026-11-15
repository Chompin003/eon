# Regiones ampliadas y escala angular

Coordinación previa: conservar el modo normal 0.02–0.25° (1.2′–15′) y añadir activación explícita de un modo ampliado hasta 1° (60′), con aviso visible de mayor espera/memoria. SkyRegion añadirá `extended?: boolean`; App compondrá la opción con ObservationsPanel, StudyPanel y RegionSelector. Enlaces y caché recordarán únicamente selecciones válidas con su modo; no se ampliará un enlace antiguo silenciosamente.

Las API conservarán sus orígenes fijos, límites de bytes y plazos. Un parámetro explícito extended=1 permitirá búsquedas SIA y catálogos de hasta 1° y recortes IMAGE de hasta 1.5° para el margen de registro. Sin ese parámetro se mantienen los límites normales. Los catálogos seguirán limitados y se indicarán resultados parciales. SEP analizará siempre píxeles originales, con un tope acotado de 2,097,152 píxeles y WASM de hasta 128 MB; no se tocarán fuentes científicas ni C de SEP. La vista previa ampliada tendrá como máximo 512 píxeles por lado y mantendrá un presupuesto explícito de memoria.

El selector permitirá confirmar el cuadro después de dibujarlo, moverlo y ajustar sus esquinas con mouse/táctil/teclado. Los límites y errores se mostrarán con contraste y tamaño legibles, incluyendo aviso fuera del panel si falla la preparación. La escala angular se calculará con la proyección real mediante separación esférica, se colocará en la esquina de cada vista y usará minutos/segundos de arco. PNG/GIF con imágenes incluirán la escala; las capas transparentes de anotaciones/marcadores no.

El PDF corto pedido se creó y abrió primero en Edge. Explica SEP, probabilidades Gaia publicadas, SIMBAD, asociaciones candidatas y límites; no se entrenó un modelo propio. Su generador se conservará para reproducirlo.

## Uso y límites entregados

En Tiempo, activa **Modo ampliado · hasta 60′** para desbloquear lados mayores de 15′. El aviso explica el coste antes de buscar o animar: hasta 16 veces el área y mayor uso de memoria. La casilla también está dentro del selector gráfico cuando se necesita superar el máximo normal. No hay modo sin límite. Desactivarla detiene una consulta ampliada pendiente y vuelve al máximo normal.

El cuadro se dibuja, se mueve arrastrando su interior y se redimensiona por las esquinas. Flechas lo desplazan; +/− cambian su tamaño y Enter confirma. **Usar esta región** confirma con mouse/táctil. El panel se oculta durante la selección y reaparece al terminar conservando su estado. Si el lado no cumple 1.2′–15′ o 1.2′–60′, se muestra un aviso de 14 px, alto contraste y confirmación bloqueada; nunca se hace una consulta inválida en silencio.

Los fallos de preparación aparecen fuera del panel con el número de fechas disponibles. Los cuadros válidos siguen reproduciéndose; no se sustituyen fallos por datos inventados. Los campos sin cobertura permanecen vacíos. La vista previa usa hasta 512×512 píxeles en modo ampliado; la resolución física y los datos originales no mejoran al ampliar el campo. El buffer de datos sigue limitado a 96 MB, la caché persistente a 96 MB y las imágenes de cada panel a 16 MB normales / 96 MB ampliadas. Filtrar por año reduce la carga. No se habilitan servicios de pago.

## Escala y exportaciones

Cada proyección muestra una barra en la esquina inferior derecha. Su longitud se obtiene por separación esférica entre coordenadas transformadas con la proyección activa; se resuelve su ancho para una longitud angular legible. Usa segundos y minutos de arco, cambia con zoom/pan/tamaño y se conserva en ambas vistas divididas. Si no hay proyección válida se oculta. PNG/GIF con espacio incluyen la escala; PNG transparentes de solo anotaciones/marcadores no. La fecha GIF se coloca arriba para separar ambos datos.

## Comprobación con datos reales

Se descargó de IRSA un IMAGE de 826×877 píxeles (724,402), 2,923,200 bytes, con recorte de 1.5° alrededor de NGC 1491. URL y momento de captura: `tests/fixtures/spherex/wide-provenance.json`. SHA-256 y referencia independiente: `wide-sep-reference.json`. Python SEP + Astropy detectaron 4,137 grupos en el recorte, 1,820 dentro del cuadrado de 1°. eon conserva 500 de mayor pico y declara el resultado parcial. Los centroides, banderas y coordenadas se contrastan con esa referencia; los bytes científicos quedan intactos. Este fixture de prueba no sustituye ninguna consulta de producción.

Las pruebas verifican límites normales/ampliados en los tres endpoints, conservación de bytes IMAGE, enlaces con opt-in, selección/movimiento/redimensionado, aviso visible, análisis sobre el recorte grande, desactivación del modo, escala esférica a alta declinación/cruce RA=0, zoom móvil y fallos visibles con el panel cerrado.
