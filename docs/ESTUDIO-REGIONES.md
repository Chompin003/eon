# Estudio de regiones

## Qué hace la opción web

La interfaz ahora añade detección real sobre los píxeles originales de las secuencias FITS mediante SEP/WebAssembly, con mediciones entre exposiciones, asociaciones candidatas, gráfica y exportaciones. [Uso, parámetros, arquitectura y límites](ANALISIS-PIXELES.md). Las marcas de catálogo descritas a continuación siguen disponibles por separado: una entrada catalogada no equivale a una detección SPHEREx. La prueba Photutils de este documento es el ensayo previo, no el motor web entregado.

**Estudiar región → Interpretar región** consulta la selección explícita, la región temporal activa o un cuadrado de hasta 15′ en el centro actual. Las marcas se proyectan con la misma API ICRS de Paint y siguen pan, zoom y fecha. El selector muestra procedencia, tipo y coordenadas de cada entrada.

**Gaia DR3**, mediante IRSA Gator, aporta astrometría y probabilidades publicadas de DSC-Combmod para estrella, galaxia y cuásar. Es un clasificador previamente entrenado por Gaia, no por eon. Si ninguna probabilidad alcanza 0.8, la entrada queda sin clasificar. Otras clases de DSC no presentes en esas columnas pueden quedar sin clasificar. La probabilidad publicada no es una precisión medida sobre SPHEREx; Gaia usa espectros y astrometría ópticos.

**CDS SIMBAD**, mediante su espejo oficial Harvard, aporta nombres y tipos de catálogo. Se conserva la descripción original; tipos sin equivalencia clara quedan sin clasificar. Un tipo catalogado puede ser una candidatura. Los proveedores se mantienen separados: una coincidencia de posición no prueba identidad. Por eso la interfaz cuenta entradas y admite que ambos catálogos incluyan el mismo objeto.

Las marcas son **posiciones de catálogo**, no detecciones demostradas en estos píxeles ni un inventario de todo lo visible. Gaia parte de la época publicada, normalmente J2016; SIMBAD indica J2000 en la metadata. Con ambos componentes de movimiento propio se aplica desplazamiento tangencial lineal a la fecha SPHEREx; sin ellos, la posición queda fija. No es seguimiento medido, ni incluye velocidad radial, perspectiva o aceleración. Sin exposición se usa la fecha actual. El filtro de región se evalúa al consultar y la posición puede desplazarse al recorrer fechas.

## Límites del servicio

`/api/catalog` solo consulta IRSA Gator y Harvard SIMBAD. No acepta URLs ni SQL del cliente. Coordenadas y lado 0.02–0.25° validados, respuesta de hasta 2 MB, plazo 30 s, caché pública de un día. Hasta 1,000 entradas por proveedor; se indica si se alcanza el límite. Se dibujan hasta 200 marcas dentro de la vista, manteniendo todas las entradas recibidas en la lista. Los fallos se muestran por proveedor; la animación no dispara consultas de catálogo por fecha.

No hay inferencia de pago, servidor Python público, R2 ni Workers AI. Se usan la caché y el despliegue Pages existentes.

Comprobación en vivo en la región inicial de lado 0.1°: los círculos de consulta devolvieron 432 filas Gaia y 15 SIMBAD; al filtrar el cuadrado quedaron 287 entradas. La consulta de interfaz tardó 1.64 s en esa ejecución local con cachés disponibles; no es una garantía universal. Una prueba controlada de tres FITS oficiales, intervalo 100 ms, 174 marcas y enlaces activos produjo 30 cuadros con mediana 99.9 ms y p95 116.5 ms, sin nuevas solicitudes FITS ni documentos WebGL durante el bucle. Se reproduce con `EON_MEASURE_STUDY=1 node --experimental-strip-types scripts/measure-regions.mjs` y el servidor en 4174, o `EON_MEASURE_URL` para otro puerto.

## Entorno y prueba sobre FITS

Se instalaron **Photutils 3.1.1 y scikit-learn 1.9.1** en `.venv`, junto con el entorno astronómico existente. `pip check` pasó. El equipo tiene 16 GB de RAM, i7-1165G7 y gráficos Intel Iris Xe; no tiene GPU NVIDIA. Había unos 23 GB libres al comenzar; no se eliminó ningún archivo del usuario.

`tools/astronomy/study_image.py` ejecuta Photutils DAOStarFinder sobre el FITS original: fondo/ruido mediante sigma clipping, umbral exploratorio 5σ, FWHM de prueba 1.5 píxeles y WCS/SIP mediante Astropy. Detecta candidatos puntuales, no clases semánticas; puede omitir emisión difusa o confundir fuentes mezcladas y PSF submuestreadas.

| FITS oficial de prueba | Candidatos | Tiempo sin arranque Python | Cruces Gaia ambiguos / sin cruce |
| ---------------------- | ---------: | -------------------------: | -------------------------------: |
| epoch-0.fits           |          9 |                     0.19 s |                            4 / 2 |
| epoch-1.fits           |          8 |                     0.15 s |                            2 / 2 |
| epoch-2.fits           |          6 |                     0.14 s |                            3 / 1 |

Los recortes son de 58×58 píxeles. El radio de cruce exploratorio es 6.15″ y usa la época de referencia Gaia sin corrección en este ensayo local; no prueba identidad. Los candidatos permanecen sin clasificar. Estos tres ejemplos no permiten medir precisión o completitud.

```powershell
.venv/Scripts/python.exe -m pip install -r tools/astronomy/requirements-study.txt
.venv/Scripts/python.exe tools/astronomy/study_image.py --fits tests/fixtures/spherex/epoch-0.fits --catalog tests/fixtures/spherex/gaia-dr3-region.xml --output data-cache/image-study.json
```

Produce JSON y PNG locales, sin subirlos ni modificar el FITS. La procedencia de las tablas reales está en `tests/fixtures/spherex/study-provenance.json`. Los casos artificiales unitarios solo comprueban validación y errores; nunca aparecen como datos reales en la aplicación.

## Decisión sobre entrenamiento

**No se inició un entrenamiento propio ni un proceso nocturno.** La solicitud permitía evaluar alternativas existentes y descartar una vía sin validación suficiente. Gaia ya aporta un clasificador publicado. Unas pocas imágenes con cruces ambiguos no bastan para entrenar algo más fiable. El entorno de aprendizaje clásico está instalado; no hay pesos nuevos ni una promesa de error pequeño.

AstroCLIP es una referencia para futuras investigaciones, pero está entrenado para representaciones de imágenes y espectros de galaxias: su publicación no valida identificar todos los objetos SPHEREx. Los agentes generales mencionados en GTC coordinan herramientas; no sustituyen etiquetas astronómicas ni validación.

Para un modelo propio se necesitan clases definidas y opción desconocida, detección con PSF/máscaras apropiadas, etiquetas verificadas y fotometría comparable entre longitudes de onda. La separación entrenamiento/prueba debe hacerse por objeto y región del cielo para evitar repetir exposiciones del mismo objeto. Después se evalúan precisión/completitud por clase, señal, calibración y casos fuera del dominio. Un baseline de árboles en CPU puede ser razonable tras reunir esos datos. El parpadeo entre exposiciones de un detector no equivale a variabilidad a longitud de onda fija.

## Referencias primarias

- [Gaia DSC: métodos y probabilidades](https://gea.esac.esa.int/archive/documentation/GDR3/Data_analysis/chap_cu8par/sec_cu8par_apsis/ssec_cu8par_apsis_dsc.html), [catálogo Gaia DR3 en IRSA](https://www.ipac.caltech.edu/doi/10.26131/IRSA544).
- [Astroquery: consultas y espejos SIMBAD](https://docs.astropy.org/projects/astroquery/en/latest/simbad/simbad.html).
- [Photutils DAOStarFinder](https://docs.astropy.org/projects/photutils/en/stable/api/photutils.detection.DAOStarFinder.html), [Astropy: movimiento de posiciones](https://docs.astropy.org/en/stable/coordinates/apply_space_motion.html).
- [AstroCLIP, publicación de sus autores](https://arxiv.org/abs/2310.03024), [keynote GTC Berlín 2026](https://www.nvidia.com/en-us/on-demand/session/gtcberlin26-sb61112/).
