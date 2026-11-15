# Estado del proyecto — 15 de noviembre de 2026

## Aplicación e infraestructura

- Enlaces con coordenadas, zoom, canales y exposición exacta, restauración pausada y actualización limitada a dos escrituras por segundo.
- Hubble/Webb solapados con transparencia y misma proyección, además de comparación dividida. Las épocas son independientes.
- Detección real sobre IMAGE con SEP 1.4.1/WASM en Worker: centroides ICRS, forma, señal en apertura, candidaturas Gaia/SIMBAD, enlaces entre exposiciones y exportación JSON/CSV. Ejemplo NGC 1491 con tres exposiciones oficiales guardadas, abierto solo explícitamente; nunca reemplaza una consulta fallida. [Método y límites](ANALISIS-PIXELES.md). No se entrenó un clasificador propio ni se promete identificar toda emisión.

- [Repositorio](https://github.com/Chompin003/eon) y [página de producción](https://eon-visualizer.pages.dev/).
- Datos reales: mosaico espectral HiPS DR1 y recortes de exposiciones FITS DR1/QR3 por coordenadas y año. B/N, superposición de dos canales, color falso y vista dividida sincronizada. Fechas reales; el conjunto guardado de ejemplo está identificado y separado de las consultas en vivo.
- Coordenadas de Iván/GorditoG integradas en el [PR #3](https://github.com/Chompin003/eon/pull/3). Su cuenta tiene permiso de escritura.
- Cuatro ramas del equipo preparadas: `feat/sky-viewer`, `feat/spherex-data`, `feat/drawing-tools`, `feat/interface`. Sus cambios se conservan al sincronizar `main`.
- Cloudflare Pages conectado con GitHub, producción `main`, build `npm run build`, salida `dist`, Node 24.11.1 y previews de todas las ramas no productivas.
- Animación de regiones seleccionables de 1.2′–15′, registro TAN-SIP en worker y reproducción Canvas 2D. Empieza con fechas disponibles y mantiene explícitas las que no tienen cobertura o fallan. Caché persistente local, pan/zoom, Paint y vista dividida. No se reconstruye WebGL ni se pide el FITS durante un bucle preparado. [Implementación y mediciones](ANIMACION-REGIONES.md).
- Paint y comparaciones Hubble/Webb conservados al integrar la optimización. La búsqueda recupera automáticamente las ventanas temporales de respuestas SIA truncadas.

## Integración sin aprobación humana

Por decisión del propietario, basta hacer push a una rama del mismo repositorio: **Auto integrate** crea o reutiliza el PR y habilita la integración automática. CI corre en cada push. GitHub integra al pasar `quality` y `Cloudflare Pages`; Cloudflare publica en la misma URL de producción.

No se exige aprobación humana ni actualizar la rama por cada merge ajeno. Los errores de build/tests, conflictos de código y PR en borrador detienen la integración. Se conservan protecciones contra force push y borrados, incluso para administradores.

Prueba real: el bot creó el [PR #4](https://github.com/Chompin003/eon/pull/4) y habilitó auto-merge; GitHub lo integró a las 15:34 del 14 de noviembre (hora de Los Ángeles), sin aprobación manual. [Workflow del bot](https://github.com/Chompin003/eon/actions/runs/43653793038), [CI correcto](https://github.com/Chompin003/eon/actions/runs/43653793045), commit de integración `e644a0a3f86306be6dd5d07b9fb3724f387384e2`.

La automatización ignora ramas sin diferencias de archivos, incluidas sincronizaciones que solo añaden historial. No borra ramas ni ejecuta código de un PR con el token de escritura del integrador.

## Herramientas Python preparadas

Se agregó un entorno Python 3.13 en `.venv` con Astroquery 0.4.11 y el extra `[all]`, Astropy 8.0.2, NumPy 2.5.4, SciPy 1.18.1, Matplotlib 3.11.2, Pillow 13.0.0 y PyVO 1.10.0. Los archivos de requisitos y la comprobación offline están en [tools/astronomy](../tools/astronomy/README.md).

Python no se ejecuta en Cloudflare ni en el navegador. `query_spherex.py --verify-first` consulta SIA con Astroquery y verifica el FITS con Astropy. El backend web consulta SIA y recortes mediante HTTP; el navegador usa Aladin. No se necesitan credenciales astronómicas. Véase [cómo funciona](COMO-FUNCIONA.md), incluida la corrección SIP para la vista temporal.

## Colaboración

Lee [COLABORACION.md](COLABORACION.md), [AGENTS.md](../AGENTS.md) y [la integración de coordenadas](INTEGRACION-COORDENADAS.md). Cada integrante usa su propia cuenta, sesión de IA y checkout. Live Share sigue disponible para sesiones compartidas iniciadas por una persona.
