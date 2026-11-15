# Comparación sin almacenar mosaicos en Cloudflare

## Encontrar las regiones

Controles → Explorar campos observados ofrece accesos directos a Hubble/Antenas y los dos mosaicos Webb del centro galáctico. «Ver campos en la esfera» vuelve a SPHEREx y muestra marcadores pulsables en sus posiciones; no descarga nuevos archivos hasta elegir un campo. Los marcadores son puntos de acceso verificados, no polígonos de cobertura ni un inventario completo del archivo. A escala grande, una capa regional muestra además un acceso a su posición para evitar quedarse mirando un campo vacío.

## Uso

En Controles → Comparar telescopios, SPHEREx sigue siendo la referencia inicial.

- Webb selecciona por defecto el mosaico NIRCam/NIRISS del centro galáctico de la Universidad de Florida. MIRI está en el selector. «Ver centro galáctico · Webb» lleva a un campo conocido. No hay cobertura de todo el cielo, ni estos mosaicos contienen M74.
- Hubble selecciona HLA/STScI, con un recorte inicial ACS/F814W de las Antenas. «Ver región del recorte Hubble» muestra su posición. Para otra región, navega con GO o el visor, pulsa «Buscar Hubble aquí» y elige una observación. No se consulta al arrastrar el cielo ni al reproducir SPHEREx. HLA contiene observaciones anteriores a octubre de 2017; no sustituye al archivo MAST completo ni aporta datos recientes.
- Ambos admiten Superposición con transparencia y Pantalla dividida. El recorte Hubble conserva su posición original al navegar; no se arrastra pegado a la pantalla. Un nuevo recorte solo se pide al elegir otra observación. Las épocas de archivos externos no cambian con las fechas SPHEREx.
- Los selectores conservan las opciones ESA anteriores para enlaces existentes. Sus errores siguen siendo explícitos. Nunca se cambia de dataset automáticamente para ocultar un fallo.

## Recursos y límites

Las teselas Florida y los recortes HLA viajan directamente al navegador mediante HTTPS/CORS. No pasan por Functions, R2, KV o D1 ni se copian al despliegue. Solo se publica código y metadata de proveedores. El proyecto no requiere nuevas dependencias, credenciales ni servicios de pago.

HLA usa una búsqueda SIAP de 0.01° limitada a 2 MiB, 20 resultados combinados ACS/WFC3 y un plazo de 20 segundos. La UI permite cancelar al navegar o iniciar otra búsqueda. Los recortes son FITS de 512 × 512, con lectura máxima de 2 MiB y 15 segundos de plazo de descarga. Solo se aceptan datasets `hst_…`, coordenadas finitas y el host fijo HLA. No se aceptan rutas de archivos ni URLs arbitrarios. Se aborta la descarga anterior al cambiar de recorte y se liberan las URLs Blob después de importar el FITS a Aladin.

No se añade una caché persistente propia de imágenes: la retención HTTP depende del proveedor y del navegador. El visor conserva únicamente su capa activa; el navegador cancela las peticiones de un iframe al retirarlo. Las búsquedas explícitas evitan consumir red por cada movimiento. Las respuestas de error no se convierten en imágenes de ejemplo.

## Proyección y alcance científico

Florida publica HiPS en coordenadas **galácticas**. Aladin lee `hips_frame=galactic` y transforma la teselación a la cámara ecuatorial compartida. Nunca se interpretan los índices HEALPix galácticos como RA/Dec.

HLA publica FITS con WCS del recorte. Se entrega el archivo original a Aladin: no se inventan tamaño angular, rotación o posición a partir de un JPEG. Un recorte pequeño puede quedar fuera del campo visible; el acceso a su región permanece disponible. HLA aplica sus correcciones astrométricas documentadas, de modo que la posición central efectiva puede diferir ligeramente del punto solicitado. Como comprobación independiente, Astropy leyó el recorte de prueba 512 × 512 y obtuvo RA 180.47159020°, Dec −18.88254548° para el centro (píxel 255.5, 255.5 con origen cero), próximo a la región solicitada.

Los mosaicos multifiltro Florida son vistas de orientación, no fotometría calibrada comparable directamente con los píxeles SPHEREx. No se ha validado precisión astrométrica entre misiones. No se modifican SEP, catálogos, análisis de píxeles o sus contratos. Los FITS HLA solo entran en la capa externa de comparación, nunca en el analizador de SPHEREx.

## Verificación

Se comprobaron en el visor con red real NIRCam/NIRISS, el recorte Hubble y la búsqueda SIAP. Las pruebas offline incluyen PNG/FITS/metadata reales y su procedencia SHA-256 en `tests/fixtures/direct/provenance.json`. Solo son fixtures de interfaz: la tesela repetida no valida el contenido científico del mapa y no se usa en producción. Se comprueban transporte directo, cambio de instrumento, transparencia, reutilización del recorte al navegar y restauración de dataset/posición en enlaces compartidos.

## Fuentes

- [Florida: inventario HiPS y procedencia](https://starformation.astro.ufl.edu/jwst-gc/hips_index.html)
- [HLA: recortes, WCS y parámetros](https://hla.stsci.edu/fitscutcgi_interface.html)
- [HLA: alcance histórico y transición a MAST](https://hla.stsci.edu/hlaview.html)
- [Cloudflare: límites de Pages](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare: solicitudes de Functions](https://developers.cloudflare.com/pages/functions/pricing/)
