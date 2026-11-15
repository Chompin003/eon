# eon

Repositorio del equipo: [Chompin003/eon](https://github.com/Chompin003/eon).

**Explorador público:** [eon-visualizer.pages.dev](https://eon-visualizer.pages.dev/).

Explorador educativo de imágenes reales de NASA/SPHEREx servidas por Caltech/IPAC IRSA. No es un producto oficial de NASA.

Visor a pantalla completa y una sola flecha para abrir una ventana móvil/redimensionable. Incluye coordenadas RA h:m:s / Dec ±d:m:s, 100 canales útiles del mosaico DR1, superposición de dos canales, B/N, color falso y pantalla dividida sincronizada. La búsqueda de exposiciones por coordenadas permite recorrer fechas reales con año, hora UTC y reproducción regulable. Paint y la comparación con mosaicos Hubble/Webb están integrados.

Las animaciones permiten seleccionar una región de 1.2′–15′, registrar sus exposiciones en una cuadrícula común y reproducirlas en un visor cuadrado Canvas 2D. Empiezan con las fechas disponibles mientras se preparan las demás; los fallos y las ausencias de cobertura se indican explícitamente. Las regiones preparadas se guardan en la caché local del navegador. No se descargan FITS ni se reconstruye WebGL durante el bucle. [Implementación y mediciones](docs/ANIMACION-REGIONES.md).

Se consultan todos los años publicados desde 2025; las respuestas SIA truncadas se recuperan mediante ventanas temporales menores.

**Copiar enlace** comparte ubicación, zoom, canales, comparación y exposición exacta; se restaura pausada. Hubble/Webb admiten solapado con transparencia o pantalla dividida y conservan sus épocas de archivo. [Enlaces y comparación](docs/ENLACES-COMPARACION-ESTUDIO.md).

**Descargar vista** exporta PNG con espacio, anotaciones y marcadores seleccionables, o GIF de las fechas preparadas con anotaciones/marcadores opcionales. PNG permite transparencia; GIF conserva siempre las imágenes. Los nombres incluyen coordenadas J2000 sexagesimales y, en GIF, el rango UTC. [Uso y límites](docs/EXPORTACION.md).

**Interpretar región** detecta fuentes en los FITS originales con SEP/WebAssembly, mide centroides, forma y señal en apertura por exposición, y propone asociaciones con Gaia/SIMBAD. Incluye marcas, tabla/gráfica temporal y exportación JSON/CSV; las coincidencias ambiguas permanecen sin clasificar. Para probarlo sin depender del archivo externo: **Abrir ejemplo real NGC 1491 → Interpretar región**. Son tres exposiciones oficiales guardadas, nunca un sustituto automático de una consulta fallida. [Método, uso y límites](docs/ANALISIS-PIXELES.md), [catálogos y evaluación de entrenamiento](docs/ESTUDIO-REGIONES.md).

El mosaico mezcla fechas y tiene muestreo aproximado de 12.88″/píxel; ampliar hasta 1″ no añade resolución. Las exposiciones individuales se obtienen como recortes FITS de 0.1° y se corrigen para visualización usando su WCS/SIP. Las longitudes de onda de un detector pueden variar entre exposiciones: el parpadeo no constituye una medición fotométrica a longitud de onda fija.

[Cómo funciona, qué se usó del documento y evaluación de Astroquery](docs/COMO-FUNCIONA.md). [Licencias y procedencia](docs/THIRD-PARTY.md).

## Desarrollo local

Requiere Node.js 24 LTS, npm y Git.

```sh
npm ci
npm run dev:full
```

Abre la dirección que imprime Wrangler (puerto 8788). Este comando construye y sirve frontend + Functions. `npm run dev` conserva Vite con recarga rápida para cambios de interfaz, sin los endpoints de exposiciones.

```sh
npm run check
npm test
npm run build
npm run preview
```

## Equipo

Lee [la guía de colaboración](docs/COLABORACION.md), [los contratos de módulos](docs/ARQUITECTURA.md) y [AGENTS.md](AGENTS.md). Cada desarrollador usa su computadora, cuenta y sesión de IA. Live Share sirve para sesiones conjuntas; Git y Pull Requests integran el trabajo independiente.

| Rama                 | Responsabilidad                    |
| -------------------- | ---------------------------------- |
| `main`               | Versión integrada para producción  |
| `feat/sky-viewer`    | Esfera, cámara, controles y WebGL  |
| `feat/spherex-data`  | Proveedores de datos y coordenadas |
| `feat/drawing-tools` | Selección y futuras anotaciones    |
| `feat/interface`     | Interfaz, controles y estilos      |

## Despliegue

Los colaboradores hacen push a su rama: **Auto integrate** crea/actualiza el PR y lo integra cuando pasan `quality` y `Cloudflare Pages`. No se exige aprobación humana. La página pública conserva la misma URL. Los fallos de tests o conflictos detienen la integración.

Cloudflare Pages: `main`, `npm run build`, salida `dist`, Node `24.11.1`. Configuración y verificación en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md). La existencia de los archivos de CI no confirma que un despliegue remoto se haya ejecutado; comprueba los estados en GitHub y Cloudflare.

Tecnologías: React, TypeScript, Vite, Aladin Lite (CDS) y Pages Functions. Three.js se conserva como referencia de desarrollo. Código de la aplicación MIT; Aladin LGPL-3.0-or-later.

El [entorno Python de astronomía](tools/astronomy/README.md) incluye Astroquery y herramientas FITS/PNG. El script `query_spherex.py --verify-first` consulta exposiciones reales y contrasta el recorte con Astropy; el runtime web usa SIA/HiPS directamente.

Consulta el [estado de la entrega](docs/ESTADO.md).

![Visor SPHEREx con datos reales](docs/preview-spherex.png)
