from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/eon-interpretacion-de-datos.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Body', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold', 'C:/Windows/Fonts/arialbd.ttf'))
W, H = 595.276, 841.89
INK, MUTED, ACCENT, LINE, PALE = map(HexColor, ['#252a2d', '#58656b', '#176266', '#d9e1e3', '#eff5f5'])
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('eon - cómo se interpretan los datos')
c.setAuthor('Equipo eon')

def text(s, x, y, size=10.5, bold=False, color=INK):
    c.setFillColor(color); c.setFont('Bold' if bold else 'Body', size); c.drawString(x,y,s)

def paragraph(s, y, x=44, width=507, size=10.5, leading=15):
    for line in simpleSplit(s, 'Body', size, width): text(line,x,y,size); y -= leading
    return y-6

def heading(s,y): text(s,44,y,12,True); return y-24

def page(n, title, sub):
    c.setFillColor(white); c.rect(0,0,W,H,fill=1,stroke=0)
    text('eon  /  INTERPRETACIÓN DE DATOS',44,H-39,9,True,ACCENT)
    text('15 noviembre 2026',442,H-39,8,False,MUTED)
    text(title,44,H-82,23,True)
    paragraph(sub,H-108,size=10)
    c.setStrokeColor(LINE); c.line(44,43,551,43)
    text('Método actual y alcance de sus resultados',44,28,8,False,MUTED)
    text(f'{n} / 2',526,28,8,False,MUTED)

def box(x,y,w,h,title,body):
    c.setFillColor(PALE); c.setStrokeColor(LINE); c.roundRect(x,y,w,h,5,stroke=1,fill=1)
    text(title,x+12,y+h-23,10,True,ACCENT)
    paragraph(body,y+h-42,x+12,w-24,9.5,13)

def arrow(x1,y1,x2,y2):
    import math
    c.setStrokeColor(ACCENT); c.setLineWidth(1.1); c.line(x1,y1,x2,y2)
    a=math.atan2(y2-y1,x2-x1)
    for d in [-.45,.45]: c.line(x2,y2,x2-7*math.cos(a+d),y2-7*math.sin(a+d))

def link(label,url,y):
    text(label,44,y,9,True,ACCENT)
    c.linkURL(url,(44,y-3,551,y+12),relative=0,thickness=0)

page(1,'Cómo interpreta eon','Detección en imágenes reales y consulta de catálogos astronómicos.')
y=paragraph('No entrenamos un modelo propio. El sistema combina un algoritmo de detección sobre los píxeles SPHEREx con información publicada en Gaia y SIMBAD. Parte de la clasificación de Gaia proviene de modelos entrenados por esa misión.',680,size=12,leading=17)
y=heading('El recorrido de una imagen',y-8)
box(44,444,145,110,'1. Datos oficiales','IRSA entrega un FITS: señal medida, fecha de observación y calibración de coordenadas.')
box(225,444,145,110,'2. Detección SEP','Estima fondo y ruido; busca grupos de píxeles con señal suficiente y mide sus centros.')
box(406,444,145,110,'3. Cruce de posición','Compara los centros con Gaia y SIMBAD; propone contrapartes, si las hay.')
arrow(189,499,225,499); arrow(370,499,406,499)
y=heading('Qué aporta cada pieza',409)
for label, body in [
    ('SEP: detección', 'Es una biblioteca abierta de análisis de imágenes. En eon se usa su código C compilado para el navegador. No es una red neuronal: estima el fondo, detecta emisión y mide posición, forma y señal en una apertura.'),
    ('Gaia: probabilidades publicadas', 'eon consulta probabilidades DSC ya calculadas por Gaia para estrella, galaxia y cuásar. No vuelve a entrenar ese clasificador. Es información óptica de Gaia; no demuestra por sí sola la clase de una fuente infrarroja SPHEREx.'),
    ('SIMBAD: información de catálogo', 'Aporta nombres, posiciones y tipos recopilados por la comunidad astronómica. La aplicación conserva su procedencia. Una cercanía en el cielo se presenta como candidatura, no como identidad confirmada.'),
]:
    text(label,44,y,10.5,True,ACCENT); y=paragraph(body,y-18,size=10.3,leading=14.5)
y=heading('Dónde están los datos',y-3)
paragraph('Los archivos científicos permanecen en IRSA; los catálogos se consultan en sus servicios. eon conserva caché local para la visualización y un ejemplo real guardado que se abre explícitamente. No instalamos una base de datos de todo el cielo ni generamos imágenes con IA.',y,size=10.3,leading=14.5)
c.showPage()

page(2,'Cómo leer los resultados','Una marca indica una medición o una entrada de catálogo, con un origen concreto.')
y=heading('Tres resultados posibles de una detección',680)
for label, body in [
    ('Una contraparte candidata', 'Hay una coincidencia de posición compatible en los catálogos consultados. La etiqueta procede del catálogo y sigue siendo una candidatura.'),
    ('Varias coincidencias', 'Hay más de una contraparte posible, o varias detecciones reclaman la misma. La aplicación conserva la ambigüedad y deja la fuente sin clasificar.'),
    ('Ninguna contraparte', 'SEP detectó señal, pero estos catálogos no dan una asociación. Esto no demuestra que sea un objeto nuevo ni que la señal sea astrofísica.'),
]:
    text(label,44,y,10.5,True,ACCENT); y=paragraph(body,y-18,size=10.5,leading=15)
y=heading('Qué mide y cómo cambia de fecha',y-7)
y=paragraph('Cada exposición se analiza sobre sus píxeles originales, no sobre la imagen interpolada de pantalla. La calibración WCS/SIP transforma el centro medido a coordenadas del cielo. Se guardan posición, forma aparente, señal en apertura y banderas de SEP.',y)
y=paragraph('Las detecciones se enlazan entre fechas cuando sus posiciones son compatibles y no hay una alternativa cercana que vuelva ambiguo el enlace. Las cruces corresponden a la fecha visible; no se inventan posiciones cuando no hay detección. Un enlace no prueba movimiento físico.',y)
y=heading('Qué límites conviene recordar',y-7)
y=paragraph('No se identifican todos los objetos visibles. Las fuentes mezcladas, débiles o difusas pueden resultar incompletas. Las medidas actuales usan IMAGE y ruido local; no incorporan toda la incertidumbre ni las correcciones necesarias para fotometría científica.',y)
y=paragraph('La longitud de onda y la forma de la imagen pueden variar entre exposiciones. Por eso la gráfica de señal no es un espectro ni una curva de luz calibrada a una misma banda. Las probabilidades de Gaia tampoco son una precisión validada sobre SPHEREx.',y)
y=heading('Cómo se comprobó',y-7)
y=paragraph('El código del navegador se contrastó con SEP de Python y Astropy sobre recortes FITS oficiales: centros, coordenadas, fondo, forma, apertura y errores. También se probaron casos ambiguos, cambio de fecha y conservación de los píxeles originales. Esas pruebas verifican cálculos; no sustituyen una evaluación de precisión por clase.',y,size=10.2,leading=14)
y=heading('Fuentes y explicación técnica',y-5)
link('Implementación y límites de eon', 'https://github.com/Chompin003/eon/blob/main/docs/ANALISIS-PIXELES.md',y); y-=21
link('SEP: documentación de sus autores', 'https://sep.readthedocs.io/en/stable/',y); y-=21
link('Gaia DR3: Discrete Source Classifier', 'https://gea.esac.esa.int/archive/documentation/GDR3/Data_analysis/chap_cu8par/sec_cu8par_apsis/ssec_cu8par_apsis_dsc.html',y)
c.save()
print(OUT)
