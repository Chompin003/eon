# Comparación SPHEREx / Hubble / Webb

**Actualización:** las opciones predeterminadas usan Florida (Webb) y HLA (Hubble) directamente desde el navegador. [Uso, recursos y límites actuales](ARCHIVOS-DIRECTOS.md). La descripción del transporte ESA a continuación aplica solamente a sus cuatro opciones históricas.

## Conexión y modos actuales

Controles → Comparar telescopios → Hubble/Webb ofrece **Superposición** y **Pantalla dividida**. En superposición, el deslizador cambia solo la transparencia del telescopio externo (0% opaco, 100% oculto). Se conserva la misma cámara y Paint; no se modifica el análisis SEP ni los catálogos.

Las teselas y los MOC de ESA se solicitan mediante `/api/telescope/0..3/`. Este transporte de Cloudflare solo admite cuatro datasets fijos y rutas HiPS válidas: propiedades, MOC, Allsky y teselas PNG/JPEG hasta orden 15. Cada petición tiene un plazo de 12 segundos, lecturas limitadas y caché pública de 24 horas para respuestas correctas. Los errores no se guardan ni se sustituyen con imágenes de prueba. No se requiere una base de datos privada o credenciales para estos mosaicos públicos.

Esta ruta evita que el navegador tenga que conectarse directamente a ESA, pero no puede reparar una caída global del proveedor. Si falla, usa Reintentar o vuelve a SPHEREx. Para desarrollo con estos endpoints usa `npm run dev:full`, no el servidor Vite sin Functions. Si aún ves la interfaz antigua, recarga la página.

En **Controles → Comparar telescopios**, SPHEREx es la referencia permanente. Hubble o Webb se añaden en **Solapada**, con transparencia predeterminada 35%. 0% muestra el archivo extra donde hay cobertura; 100% deja SPHEREx. También se puede elegir **Pantalla dividida**, con SPHEREx a la izquierda. Ambas comparten RA/Dec ICRS y FOV horizontal. Paint conserva sus anotaciones. Volver al botón SPHEREx quita el archivo externo.

En el mosaico, el solapado usa dos capas en una instancia Aladin. En la animación Canvas 2D, el archivo usa una TAN centrada en la región fija y su contenedor aplica la transformación exacta de la cuadrícula temporal; el pan no recentra erróneamente la TAN del archivo. La resolución del iframe permanece acotada y el zoom es una transformación visual. Los puntos contrastados en navegador difieren menos de 0.1 píxel en los casos probados.

## Fuentes verificadas

| Telescopio | Mosaico oficial ESA                                               | Publicación del mosaico |
| ---------- | ----------------------------------------------------------------- | ----------------------- |
| Hubble     | [ACS, todos los filtros](https://skies.esac.esa.int/HST/ACS/)     | 2016-11-11              |
| Hubble     | [WFC3, todos los filtros](https://skies.esac.esa.int/HST/WFC3/)   | 2016-09-30              |
| Webb       | [NIRCam Imaging](https://skies.esac.esa.int/JWST/NIRCam_Imaging/) | 2024-07-15              |
| Webb       | [MIRI Imaging](https://skies.esac.esa.int/JWST/MIRI_Imaging/)     | 2024-07-13              |

Los URL y `creator_did` proceden del [registro oficial](https://skies.esac.esa.int/hipslist) y los archivos `properties`. Son **vistas HiPS progresivas de cobertura parcial**, no barridos completos de todo el cielo ni archivos actualizados a la fecha de visita. Hubble ACS/WFC3 indican observaciones recopiladas hasta agosto de 2015. Los mosaicos mezclan filtros y exposiciones; sus fechas de publicación no son fechas de observación ni sus valores una banda homogénea. No deben usarse para fotometría directa o para inferir cambios temporales al lado de SPHEREx.

Se comprueba el centro contra el MOC FITS publicado por cada proveedor. Si está fuera de cobertura, aparece un aviso; el resto del campo puede contener observaciones. Si el MOC falla, se indica que no pudo verificarse, sin sustituirlo por datos sintéticos. Los fallos de ESA no bloquean el panel SPHEREx. El botón **Ver M74 · cobertura común** centra RA 24.173958°, Dec +15.783667° y FOV 0.14°; se verificó que ese punto pertenece a los cuatro MOC. Si se estaba mostrando otra exposición individual de SPHEREx, ese botón vuelve al mosaico antes de cambiar de región.

Las teselas se consultan directamente a ESA según la posición y el zoom; no se descarga el archivo completo ni se instala otro visor. El esquema usa los documentos Aladin aislados y la misma proyección que Paint. Solo se aceptan los cuatro endpoints declarados en `shared/archiveSurveys.ts`. No se modifican la WCS ni los píxeles de SPHEREx, ni se relajan los endpoints del backend IRSA.

En la comprobación en vivo del 15 de noviembre de 2026, `skies.esac.esa.int` agotó los plazos de espera. Los espejos registrados en MOCServer CDS devolvieron 404 o tampoco respondieron; no se adoptaron como sustitutos. La interfaz indica carga pendiente y, tras 30 s, permite reintentar conservando SPHEREx. Las pruebas de solapado usan los archivos oficiales previamente grabados y verifican la geometría, pero no demuestran disponibilidad actual de ESA. No se publican esas teselas de prueba como fallback de la aplicación.

## Astroquery instalado y comprobado

En esta computadora se creó `.venv` en este checkout usando Python 3.12.14 del runtime disponible; se instalaron los requisitos astronómicos fijados por el proyecto, incluidos **Astroquery 0.4.11**, Astropy 8.0.2 y MOCpy. Se ejecutaron `pip check`, el chequeo offline FITS/WCS/PNG y consultas públicas reales MAST de HST y JWST en M74. No se cambió el Python global ni se añadieron dependencias npm.

```powershell
.\.venv\Scripts\python.exe tools/astronomy/query_telescopes.py --telescope both --limit 25
.\.venv\Scripts\python.exe tools/astronomy/query_telescopes.py --telescope Hubble --ra 24.173958 --dec 15.783667 --radius 0.05
.\.venv\Scripts\python.exe tools/astronomy/query_telescopes.py --telescope Webb --ra 24.173958 --dec 15.783667 --radius 0.05
```

El script consulta metadata pública de imágenes de nivel 2/3 mediante `astroquery.mast.Observations`, guarda la primera página limitada en `data-cache/telescope-observations.json` y no descarga imágenes ni requiere iniciar sesión. El manifiesto contiene instrumento, filtros, fecha real UTC, posición y URI del producto. `data-cache` y `.venv` están excluidos de Git. La consulta se verificó con 10 resultados JWST (primera página de la consulta conjunta) y tres HST en una consulta separada; no son el total del archivo.

**Astroquery es el cliente local de búsqueda, no el renderizador de la página.** Aladin/HiPS sigue siendo el motor web; Python no se ejecuta dentro del navegador ni en Cloudflare Pages. Para análisis por banda/fecha usa los productos científicos individuales de [MAST](https://archive.stsci.edu/missions-and-data/jwst) y [Astroquery/MAST](https://docs.astropy.org/projects/astroquery/en/stable/mast/mast_obsquery.html), no una captura del mosaico. El módulo Astroquery/ESASky existe, pero su endpoint TAP devolvió HTML en esta comprobación; las consultas locales verificadas usan MAST y las capas web usan los HiPS oficiales ESA.

## Validación

Comprobaciones completadas: TypeScript/lint, 44 pruebas unitarias, build y 10 pruebas de navegador. Se comprobó además la carga directa de SPHEREx junto a Hubble ACS y Webb NIRCam en M74; [captura de la comparación real](telescope-comparison.png).

Los tests de navegador usan propiedades/MOC y miniaturas Allsky reales grabadas desde ESA, más una tesela real de M74 por instrumento repetida para probar la interfaz sin red. `tests/fixtures/telescopes/provenance.json` registra URL, fecha y SHA-256. Las teselas repetidas no validan astrometría/fotometría ni son fallback del runtime. Se prueba SPHEREx predeterminado, los cuatro instrumentos, cobertura, sincronía, fallos de archivo y conservación de Paint. La vista con imágenes reales se verifica aparte.
