# Enlaces, comparación y estudio de regiones

Coordinación previa: App compondrá un estado URL validado (ICRS, FOV, canales, vista, región y exposición), con replaceState limitado y restauración de navegación. Se conservarán ViewState en grados, coordinateTools, drawingTools y SkyProjection. shared alojará solo contratos y serialización sin importar módulos.

La comparación añadirá modo split/overlay y transparencia independiente de la superposición espectral. Aladin deberá proyectar ambas fuentes HiPS con una misma cámara; para regiones TAN se alineará explícitamente la proyección del archivo con la cuadrícula temporal, sin atribuir épocas iguales a mosaicos heterogéneos. No se inventarán fechas de Hubble/Webb ni se sustituirá una ausencia de cobertura por imágenes.

El estudio se implementará después de comprobar datos, hardware y herramientas existentes. Se diferenciarán identificaciones de catálogo, detecciones sin clasificar y predicciones. No se habilitarán servicios facturables, descargas masivas ni eliminación de archivos. Cualquier endpoint de catálogo nuevo se documentará con un origen oficial fijo y límites explícitos.
