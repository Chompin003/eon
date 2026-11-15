"""Technical handout. Vector diagrams; no generated illustrations."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/eon-como-funciona.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Body','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold','C:/Windows/Fonts/arialbd.ttf'))
W,H=595.276,841.89
INK=HexColor('#20272b');MUTED=HexColor('#58666c');LINE=HexColor('#d7dfe1');ACCENT=HexColor('#176266');PALE=HexColor('#eff5f5')
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('eon - funcionamiento y arquitectura');c.setAuthor('Equipo eon')

def txt(text,x,y,size=10,font='Body',color=INK):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,text)
def para(text,y,x=44,width=507,size=10.5,leading=15):
 for line in simpleSplit(text,'Body',size,width):txt(line,x,y,size);y-=leading
 return y-9
def heading(text,y):txt(text,44,y,12,'Bold');return y-23
def page(number,title,sub):
 c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
 txt('eon  /  NOTA TÉCNICA',44,H-40,9,'Bold',ACCENT);txt('14 noviembre 2026',442,H-40,8,color=MUTED)
 txt(title,44,H-83,22,'Bold')
 para(sub,H-109,size=10)
 c.setStrokeColor(LINE);c.line(44,42,W-44,42);txt('Funcionamiento, datos y límites de interpretación',44,28,8,color=MUTED);txt(f'{number:02d} / 07',510,28,8,color=MUTED)
def box(x,y,w,h,title,body=''):
 c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
 txt(title,x+12,y+h-22,10,'Bold',ACCENT)
 for i,line in enumerate(simpleSplit(body,'Body',9,w-24)):txt(line,x+12,y+h-39-i*13,9)
def arrow(x1,y1,x2,y2,label=''):
 c.setStrokeColor(ACCENT);c.setLineWidth(1.1);c.line(x1,y1,x2,y2)
 import math
 a=math.atan2(y2-y1,x2-x1)
 for d in [-.45,.45]:c.line(x2,y2,x2-7*math.cos(a+d),y2-7*math.sin(a+d))
 if label:txt(label,(x1+x2)/2-25,(y1+y2)/2+7,8,color=MUTED)
def rule(y):c.setStrokeColor(LINE);c.line(44,y,551,y)
def link(label,url,y):
 txt(label,44,y,9,'Bold',ACCENT);c.linkURL(url,(44,y-2,550,y+12),relative=0,thickness=0)
 return para(url,y-16,size=8.3,leading=12)

page(1,'Cómo funciona eon','Guía para explicar el sistema a una persona que conoce el proyecto, aunque no conozca su código.')
y=para('eon permite explorar imágenes infrarrojas reales de SPHEREx, orientar el cielo con coordenadas y comparar exposiciones obtenidas en fechas distintas. La interfaz es un visor grande y una ventana de controles móvil. No genera imágenes del cielo con IA.',H-157)
y=heading('Mapa del sistema',y-8)
box(44,445,225,125,'Navegador','React + TypeScript: estado, coordenadas, fechas y controles. Aladin Lite: proyección astronómica y capas. Paint: anotaciones ancladas al cielo.')
box(326,445,225,125,'Archivo oficial IRSA','NASA/SPHEREx y Caltech/IPAC publican mosaicos HiPS, metadatos de observaciones y archivos FITS calibrados.')
arrow(269,535,326,535,'HiPS')
box(44,285,225,100,'Preparación temporal','Recortes FITS, corrección visual de distorsión y cuadros preparados. La fecha pertenece a la exposición, no al canal espectral.')
box(326,285,225,100,'Cloudflare Pages','Sirve la aplicación y dos endpoints: /api/observations y /api/cutout. No hay un servidor Python permanente.')
arrow(155,445,155,385);arrow(438,445,438,385);arrow(326,335,269,335,'FITS')
y=para('Dos rutas de datos: las teselas HiPS van directamente de IRSA al navegador. Las búsquedas y los recortes pasan por las Functions del sitio, que acotan rutas, tamaño y tiempo de espera.',247)
y=heading('Responsabilidades separadas',y-7)
y=para('El navegador mantiene la vista y presenta las imágenes. IRSA conserva los datos originales. GitHub guarda el código y ejecuta las comprobaciones. Cloudflare publica la versión integrada. Astroquery y Astropy permiten consultar y contrastar los datos desde Python.',y)
para('Del documento del equipo se retomaron Three.js, Astroquery, IRSA/SIA y los requisitos RA/Dec. Aladin y los detalles de HiPS/FITS provienen de CDS y de los recursos oficiales astronómicos. El código propio conecta esas piezas.',y,size=10,leading=14)
c.showPage()

page(2,'Dos productos, dos usos','Los canales del mosaico y las fechas de las exposiciones son ejes diferentes.')
box(44,555,507,125,'Mosaico espectral HiPS DR1','Exploración continua del cielo con teselas que cambian de resolución al ampliar. El cubo tiene 102 canales; dos están vacíos según IRSA. Hay 100 selecciones útiles, con longitudes de onda leídas de sus metadatos.')
y=para('Canal A y canal B son selecciones espectrales. En blanco y negro puede verse A o superponer B; en color falso, A se asigna a rojo y B a azul. La pantalla dividida compara B/N y color con el mismo centro y zoom.',526)
y=para('El mosaico mezcla observaciones de distintas fechas. No permite afirmar que toda la imagen corresponde a un año concreto. Su muestreo publicado es aproximadamente 12.88 segundos de arco por píxel. Ampliar hasta 1 segundo de arco no crea detalle nuevo.',y)
rule(y-5)
box(44,281,507,113,'Exposiciones individuales FITS','Una consulta por RA/Dec devuelve las imágenes que cubren esa posición. El resultado incluye identificador, detector, colección, URL y tiempo de observación t_min. La aplicación ordena esas filas cronológicamente.')
y=para('Al seleccionar una exposición se solicita un recorte de 0.1 grados. Solo se muestra la extensión IMAGE, cuya señal está en MJy/sr. FLAGS describe calidad, VARIANCE estima incertidumbre y ZODI modela luz zodiacal: ninguna debe confundirse con la imagen de señal.',253)
y=para('En una exposición, Color es pseudocolor viridis de una sola imagen. Las exposiciones de un detector pueden medir longitudes de onda distintas por su filtro variable. Un cambio de brillo al parpadear no demuestra por sí solo variabilidad física.',y)
c.showPage()

page(3,'Coordenadas y registro del cielo','La imagen debe conservar su posición al cambiar de fecha, ampliar o dibujar.')
y=heading('Del formulario a la proyección',680)
box(44,570,145,70,'RA / Dec','Horas:minutos:segundos y grados:minutos:segundos.')
box(225,570,145,70,'Grados ICRS','Estado común: longitud, latitud y campo horizontal.')
box(406,570,145,70,'Píxeles de pantalla','Aladin transforma el cielo a la posición visible.')
arrow(189,605,225,605);arrow(370,605,406,605)
y=para('El formulario de Iván conserva el zoom al aplicar una posición. RA abarca 0 a menos de 360 grados; Dec admite de -90 a +90 grados. La declinación -00°15′30″ debe conservar el signo: equivale a -0.258333... grados.',538)
y=heading('Qué aportan WCS y SIP',y-8)
y=para('WCS es la información de la cabecera FITS que relaciona píxeles y coordenadas del cielo. SIP representa la distorsión geométrica del detector. Colocar una imagen como una textura cualquiera sobre una esfera no resuelve esa calibración.',y)
box(44,305,145,75,'FITS original','Se conserva señal y cabecera científica.')
box(225,305,145,75,'Copia para visualizar','Se corrige SIP con interpolación bilineal.')
box(406,305,145,75,'Proyección TAN','Aladin presenta la copia con coordenadas coherentes.')
arrow(189,343,225,343);arrow(370,343,406,343)
y=para('El adaptador SIP cubre una incompatibilidad observada en Aladin Lite 3.8.2 con estos recortes. Se contrastó con Astropy/WCSLIB y SciPy. La copia interpolada sirve para visualizar; para fotometría se debe volver al FITS científico original.',275)
y=heading('Anotaciones y vista dividida',y-7)
para('Paint ya forma parte del proyecto. Sus trazos se anclan a coordenadas del cielo y usan la proyección del visor para volver a dibujarse. En modo dividido, ambas vistas reciben el mismo centro y campo angular; no se sincronizan copiando posiciones de pantalla.',y)
c.showPage()

page(4,'Cómo se recorre el tiempo','La pausa de red debe ocurrir durante la preparación, no entre cada cuadro de una animación.')
y=para('El problema observado: cambiar de fecha volvía a crear el documento del visor. Después había que descargar el FITS, corregir SIP, interpretar la imagen y crear recursos WebGL. El intervalo elegido se añadía a ese trabajo: 100 ms en el control no significaban 100 ms entre cuadros visibles.',681)
y=heading('Flujo anterior',y-8)
for x,title,body in [(44,'Seleccionar','Elegir la fecha'),(216,'Esperar','Red + SIP + visor'),(388,'Mostrar','Ver un solo cuadro')]:box(x,476,163,72,title,body)
arrow(207,512,216,512);arrow(379,512,388,512)
txt('Este recorrido se repetía en cada fecha.',44,454,9,color=MUTED)
y=heading('Flujo implementado',416)
box(44,272,225,107,'1. Preparar una vez','Consultar fechas; descargar recortes con concurrencia limitada; corregir distorsión; conservar los cuadros y crear las capas necesarias.')
box(326,272,225,107,'2. Reproducir desde memoria','Mantener el visor abierto y alternar únicamente el cuadro visible. Pausar, repetir o cambiar velocidad sin otra descarga.')
arrow(269,326,326,326)
y=para('La preparación debe indicar avance y errores. Reproducir se habilita cuando la secuencia está lista. Ninguna exposición fallida se elimina en silencio. La memoria debe tener un límite y los cambios de región o detector deben cancelar el trabajo anterior.',242)
para('La corrección SIP se ejecuta en un Web Worker. La caché de copias visuales y la selección activa tienen un límite de 96 MB cada una; Aladin añade sus recursos por panel. El modo dividido comparte las descargas y prepara sus dos vistas antes de reproducir.',y)
c.showPage()

page(5,'Del código a la página pública','Los cambios del equipo se integran mediante ramas y comprobaciones automáticas.')
box(44,570,225,82,'Trabajo en una rama','Cada integrante usa su cuenta y su checkout. App compone módulos a través de contratos compartidos.')
box(326,570,225,82,'Push a GitHub','La automatización abre o actualiza el PR y habilita su integración automática.')
arrow(269,611,326,611)
box(44,416,225,91,'Comprobaciones','TypeScript, ESLint, pruebas, build y empaquetado de Functions. Cloudflare también comprueba el despliegue de prueba.')
box(326,416,225,91,'Main y producción','Cuando pasan los checks, GitHub integra y Cloudflare publica. Conflictos o fallos detienen el proceso.')
arrow(438,570,438,536);arrow(438,536,155,536);arrow(155,536,155,507);arrow(269,461,326,461)
y=heading('Mapa del repositorio',380)
for title,body in [('viewer','Proyección, imágenes, navegación y adaptación del visor.'),('data','Consulta de observaciones y formulario de coordenadas.'),('ui / drawing','Ventana de controles y anotaciones del cielo.'),('shared','Tipos y contratos; los módulos no se importan entre sí.'),('functions / server','Acceso acotado a IRSA y extracción del HDU IMAGE.')]:
 txt(title,44,y,10,'Bold',ACCENT);y=para(body,y,x=163,width=388,size=10,leading=14)
para('Repositorio: github.com/Chompin003/eon. El nuevo sitio eon-visualizer.pages.dev está conectado a ese repositorio. La publicación conserva el mismo flujo automático de ramas, checks e integración; no requiere aprobar cada cambio.',y-9)
c.showPage()

page(6,'Herramientas, años y fuentes','Qué se reutiliza y qué partes conectan las herramientas entre sí.')
y=680
for title,body in [('IRSA + SIA','Fuente oficial de archivos y protocolo para descubrir exposiciones por posición y tiempo.'),('Aladin Lite / CDS','Motor abierto para HiPS, proyecciones y representación de imágenes. El equipo también integró mosaicos Hubble/Webb, con cobertura parcial.'),('Astroquery + Astropy','Consultas Python reproducibles y verificación de FITS, fechas y WCS. Astroquery no almacena todos los PNG ni actualiza una web por sí solo.'),('React / TypeScript / Vite','Estado, interfaz, contratos, compilación y carga de módulos.'),('Three.js / react-rnd','Three.js fue el primer checkerboard de prueba. react-rnd maneja la ventana de controles.'),('Código de conexión','Validación, extracción IMAGE, adaptación SIP, sincronización de vistas y preparación de secuencias.')]:
 txt(title,44,y,10,'Bold',ACCENT);y=para(body,y-17,size=9.8,leading=13)
y=heading('Por qué solo aparecen 2025 y 2026',y-9)
y=para('SPHEREx se lanzó en marzo de 2025. A la fecha de esta guía, noviembre de 2026, sus observaciones abarcan esos dos años calendario. WISE es otra misión con una historia más larga. Todas las fechas disponibles dependen de la zona, el detector y la publicación del archivo; no todas las regiones tienen la misma cobertura.',y,size=10,leading=14)
y=heading('Fuentes y lectura técnica',y-6)
for label,url in [('SPHEREx en IRSA','https://irsa.ipac.caltech.edu/Missions/spherex.html'),('Imágenes espectrales y SIA','https://caltech-ipac.github.io/irsa-tutorials/spherex-intro/'),('Cubo HiPS y canales','https://caltech-ipac.github.io/irsa-tutorials/spherex-hipscube/'),('Convención SIP','https://fits.gsfc.nasa.gov/registry/sip.html'),('Código y explicación ampliada','https://github.com/Chompin003/eon')]:y=link(label,url,y)
c.showPage()

page(7,'Verificación y rendimiento','Esta página distingue los resultados comprobados de los objetivos de la optimización.')
y=para('La base científica se comprobó con datos reales: en la región inicial, la consulta devolvió 395 filas y 60 exposiciones D4 entre agosto de 2025 y septiembre de 2026. Un recorte de 58 x 58 píxeles conservó su WCS/SIP. La distorsión y el remuestreo se contrastaron con Astropy y SciPy.',680)
y=heading('Criterios de aceptación de la mejora',y-8)
for text in ['La secuencia se prepara antes de reproducir y muestra avance.', 'Un bucle ya preparado no descarga de nuevo los FITS.', 'El visor no se reconstruye en cada fecha.', 'La fecha visible corresponde al cuadro presentado.', 'Cambiar velocidad, B/N o color reutiliza los cuadros preparados.', 'Una búsqueda truncada recupera ventanas temporales adicionales.', 'Coordenadas, Paint y sincronización siguen funcionando.']:
 txt('•',46,y,10,color=ACCENT);y=para(text,y,x=61,width=490,size=10,leading=14)
report=ROOT/'data-cache/eon-performance.json'
y=heading('Resultado de la implementación',y-12)
if report.exists():
 r=json.loads(report.read_text(encoding='utf-8'));y=para(r['summary'],y)
 for line in r.get('measurements',[]):y=para(line,y,size=10,leading=14)
else:y=para('Medición pendiente: esta primera edición documenta el sistema y el diseño de la mejora. Se actualizará al terminar la implementación; no se atribuyen todavía cifras de velocidad a un cambio sin medir.',y)
y=heading('Límites que permanecen',y-8)
para('La red y la preparación inicial pueden tardar. La memoria disponible limita el tamaño de una secuencia. La visualización no elimina los artefactos del mosaico ni homogeneiza automáticamente longitud de onda o PSF entre exposiciones. Comparar imágenes ayuda a investigar; una conclusión científica necesita esos controles adicionales.',y,size=10,leading=14)
c.save();print(OUT)
