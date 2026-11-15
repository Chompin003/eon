# Anotaciones de estudio sobre SPHEREx

Paint se monta en el slot `drawingTools` del panel existente. Abre **Paint → Herramientas** y activa **Anotar** para usar lápiz, línea, figuras, borrado parcial y selección. El color, grosor y transparencia también se aplican a la selección. Hay deshacer/rehacer, imágenes PNG/JPG locales y un panel de emojis con categorías y búsqueda. La cuadrícula del laboratorio no se añade sobre los datos reales.

Desactiva **Anotar** para navegar con ratón, teclado o gestos. **Mostrar anotaciones** controla solo esta capa; no afecta el mosaico, los espectros, las fechas ni las exposiciones FITS. Las anotaciones son compartidas entre los dos paneles espectrales y se conservan al cambiar de exposición o canal. Los recursos gráficos importados son señalamientos del usuario, no imágenes astronómicas calibradas.

## Coordinación de módulos

- `drawing` conserva herramientas, geometría, historial y SVG; no importa `viewer`, `data` ni `ui`.
- `App.tsx` monta `PaintTools` y pasa `PaintSurface` al nuevo punto de composición `SkyViewer.renderAnnotations`.
- `shared/SkyProjection` es un contrato **de solo lectura**: píxel ↔ ICRS, tamaño, vista y suscripción a cambios. No permite configurar capas, modificar FITS ni mover el cielo.
- Cada documento de Aladin expone esa interfaz a su padre del mismo origen una vez iniciado. El visor inyecta la capa en cada panel conectado y la retira al cargar o fallar una fuente. Las suscripciones y eventos se liberan al desmontar.
- Las posiciones se obtienen de `pix2world` y se dibujan con `world2pix` de la proyección real de Aladin. Se reproyectan al navegar, cambiar de zoom o redimensionar. No se reutiliza la proyección plana de 20° del laboratorio.

Los trazos son señalamientos ICRS. Las figuras muestrean sus bordes en RA/Dec; las imágenes y emojis se dibujan como marcas con caja visual proyectada. Los cortes del borrador son máscaras vectoriales con una escala local aproximada; no representan regiones de fotometría, máscaras FITS ni medidas de precisión astrométrica. Ninguna anotación se escribe sobre los píxeles originales ni cambia la WCS/SIP. Las figuras y marcas muy grandes pueden deformarse con la proyección: deben usarse como señalamientos, no como mapas científicos.

## Recursos y almacenamiento

No añade dependencias ni solicitudes a servicios de emojis. Los glifos son locales y el panel se crea al abrirlo. El borrador filtra por cajas cacheadas y añade máscaras solo a candidatos; no lee píxeles de imágenes SPHEREx. Se agrupan movimientos y reproyecciones con `requestAnimationFrame`, se simplifican puntos casi colineales y se reutilizan nodos SVG y geometría. No existe un bucle de dibujo permanente cuando no hay cambios. El historial conserva hasta 50 acciones con referencias compartidas. Una sesión muy larga puede acumular puntos y máscaras: el coste depende de las anotaciones visibles, no está garantizado un FPS fijo.

Las imágenes locales admiten PNG/JPG de hasta 10 MB. Las anotaciones permanecen en memoria en esta pestaña; **exporta antes de recargar/cerrar**. PNG exporta una capa transparente del panel activo; JPG exporta las mismas anotaciones sobre blanco. Ambos excluyen los píxeles científicos, no incluyen WCS ni objetos editables y no sustituyen la descarga del FITS original.

## Validación

`npm run check`, `npm test`, `npm run build` y `npm run test:e2e`. Las pruebas del navegador usan las fixtures oficiales registradas por el proyecto; las teselas repetidas de esa prueba no validan astrometría. Paint comprueba la reproyección usando la API real de Aladin, el borrado parcial, el historial, la exportación, los símbolos/imágenes y la persistencia entre fuentes y paneles. La disponibilidad de IRSA se comprueba por separado en la vista con red real.
