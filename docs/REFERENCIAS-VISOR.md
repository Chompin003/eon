# Referencias del visor — historial de la primera interfaz

La sección siguiente describe la etapa inicial con checkerboard. La implementación actual con datos reales, el uso de Astroquery/SIA, Aladin y las decisiones espectrales/temporales están documentados en [COMO-FUNCIONA.md](COMO-FUNCIONA.md).

## Documento del equipo

Se leyó la pestaña disponible de [E-STAR](https://docs.google.com/document/d/159sdeV38skKriQqp0xtZTA1YNfZYdF8qQIfoH7sSTW4/edit). Identifica J2000 RA/Dec, el conversor INCON, la calculadora de Swift y Three.js. Se mantiene **Three.js**, ya instalado, como base del visor; no se sustituye por un motor inventado. La conversión de coordenadas y Paint pertenecen a otros integrantes.

- RA se presentará en horas, minutos y segundos; Dec en grados, minutos y segundos de arco con signo. Internamente la API actual conserva grados.
- [Conversor de Swift](https://www.swift.psu.edu/toop/convert.php): referencia independiente para las pruebas del futuro conversor.
- Revisar con el compañero de coordenadas dos detalles del documento: el signo de declinaciones negativas de menos de 1° no se puede deducir de un entero igual a cero; las coordenadas escritas para Barnard’s Star repiten las de Betelgeuse y requieren verificación. No se copian como fixtures científicas.

## WISE View: código abierto consultado

Repositorio original: [backyardworlds/wiseview](https://github.com/backyardworlds/wiseview), licencia de dominio público indicada en su README. Se consultaron `wv/www/templates/flash3.html` y `wv/www/static/flash3.js`.

El código separa posición RA/Dec, campo de visión angular en segundos de arco, escala de imagen y un intervalo de parpadeo en milisegundos. La cadencia de pantalla no equivale al tiempo entre observaciones. Se aplica esa separación de responsabilidades a los controles temporales. No se copió su antigua pila jQuery ni se conectaron imágenes WISE al checkerboard.

## Ventana flotante

Se incorpora [react-rnd](https://github.com/bokuweb/react-rnd), MIT, para arrastre y redimensionado con mouse y touch, en lugar de implementar otro sistema de ventanas. La capa propia aporta límites del viewport, teclado, cierre y slots de integración. La ventana tiene tipografía del sistema y controles neutros, sin cabecera de promoción, navegación ni paneles fijos.

## Challenge y recursos

Challenge identificado: [Planet X and SPHEREx, NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/). El dominio oficial devolvió error al consultarlo desde las herramientas. Para revisar objetivos y la lista de recursos se consultó la [publicación del evento local HackAthlone](https://hackathlone.com/challenges/planet-x-and-spherex), que enlaza al enunciado oficial; no se presenta esa copia como si fuera la página de NASA.

Su objetivo central es visualizar una misma región en distintas observaciones para reconocer movimiento y variabilidad. Esta iteración prepara los controles; no afirma mostrar observaciones reales. La lista apunta a IRSA, sus notebooks, WISE View y Gaia, entre otros recursos. No se amplía ahora a análisis espectral, diferencias de imágenes o catálogos.

Se revisaron por encima las fuentes primarias:

- [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html): archivo, cutouts y herramientas de imágenes.
- [Notebooks oficiales](https://caltech-ipac.github.io/irsa-tutorials/spherex/): acceso a imágenes, cutouts, mosaicos y HiPS; quedan como base de la siguiente etapa de datos.

Las cuatro fechas de `demoEpochs` son exclusivamente fixtures de interfaz, no fechas de cobertura, disponibilidad o lanzamientos. La imagen permanece idéntica al mover la fecha o reproducir la secuencia. El rango máximo de zoom permite probar la navegación; no añade información a una imagen científica ni promete resolución de un segundo de arco.
