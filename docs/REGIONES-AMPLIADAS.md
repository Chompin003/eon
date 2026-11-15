# Regiones ampliadas y escala angular

Coordinación previa: conservar el modo normal 0.02–0.25° (1.2′–15′) y añadir activación explícita de un modo ampliado hasta 1° (60′), con aviso visible de mayor espera/memoria. SkyRegion añadirá `extended?: boolean`; App compondrá la opción con ObservationsPanel, StudyPanel y RegionSelector. Enlaces y caché recordarán únicamente selecciones válidas con su modo; no se ampliará un enlace antiguo silenciosamente.

Las API conservarán sus orígenes fijos, límites de bytes y plazos. Un parámetro explícito extended=1 permitirá búsquedas SIA y catálogos de hasta 1° y recortes IMAGE de hasta 1.5° para el margen de registro. Sin ese parámetro se mantienen los límites normales. Los catálogos seguirán limitados y se indicarán resultados parciales. SEP analizará siempre píxeles originales, con un tope acotado de 2,097,152 píxeles y WASM de hasta 128 MB; no se tocarán fuentes científicas ni C de SEP. La vista previa ampliada tendrá como máximo 512 píxeles por lado y mantendrá un presupuesto explícito de memoria.

El selector permitirá confirmar el cuadro después de dibujarlo, moverlo y ajustar sus esquinas con mouse/táctil/teclado. Los límites y errores se mostrarán con contraste y tamaño legibles, incluyendo aviso fuera del panel si falla la preparación. La escala angular se calculará con la proyección real mediante separación esférica, se colocará en la esquina de cada vista y usará minutos/segundos de arco. PNG/GIF con imágenes incluirán la escala; las capas transparentes de anotaciones/marcadores no.

El PDF corto pedido se creó y abrió primero en Edge. Explica SEP, probabilidades Gaia publicadas, SIMBAD, asociaciones candidatas y límites; no se entrenó un modelo propio. Su generador se conservará para reproducirlo.
