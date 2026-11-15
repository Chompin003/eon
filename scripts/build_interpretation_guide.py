"""Human guide to the implemented eon pipeline. Requires ReportLab; no network."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import os
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, Table, TableStyle, Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/eon-metodo-e-interpretacion.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
MANIFEST = json.loads((ROOT / 'public/examples/spherex/manifest.json').read_text(encoding='utf-8'))
font_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
if (font_dir / 'arial.ttf').exists():
    pdfmetrics.registerFont(TTFont('Body', str(font_dir / 'arial.ttf')))
    pdfmetrics.registerFont(TTFont('BodyBold', str(font_dir / 'arialbd.ttf')))
else:
    pdfmetrics.registerFont(pdfmetrics.Font('Body', 'Helvetica', 'WinAnsiEncoding'))
    pdfmetrics.registerFont(pdfmetrics.Font('BodyBold', 'Helvetica-Bold', 'WinAnsiEncoding'))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')
INK, MUTED, ACCENT, PALE, LINE = [colors.HexColor(v) for v in ['#242c2b','#596561','#226554','#eef5f1','#d9e2de']]
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('TitleE', fontName='BodyBold', fontSize=25, leading=30, textColor=INK, spaceAfter=15))
styles.add(ParagraphStyle('DeckE', fontName='Body', fontSize=11.5, leading=17, textColor=MUTED, spaceAfter=15))
styles.add(ParagraphStyle('BodyE', fontName='Body', fontSize=10.2, leading=15, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle('HeadE', fontName='BodyBold', fontSize=12, leading=17, textColor=ACCENT, spaceBefore=13, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle('SmallE', fontName='Body', fontSize=8.3, leading=12, textColor=MUTED, spaceAfter=7, wordWrap='CJK'))
styles.add(ParagraphStyle('CellE', fontName='Body', fontSize=9, leading=13, textColor=INK))
story = []
def p(text, style='BodyE'):
    return Paragraph(text, styles[style])
def body(text): story.append(p(text))
def head(text): story.append(p(text, 'HeadE'))
def title(label, subtitle):
    story.extend([p(label,'TitleE'),p(subtitle,'DeckE')])
def table(rows, widths, padding=8):
    t = Table([[p(escape(str(v)), 'CellE') for v in row] for row in rows], colWidths=widths, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.7,LINE),('LINEBELOW',(0,1),(-1,-1),.4,LINE),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),padding),('BOTTOMPADDING',(0,0),(-1,-1),padding)]))
    story.append(t)

class Pipeline(Flowable):
    def __init__(self): super().__init__(); self.width=499; self.height=203
    def draw(self):
        c=self.canv
        def box(x,y,w,h,label,desc):
            c.setFillColor(PALE);c.setStrokeColor(LINE);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
            a=p(label,'HeadE');a.wrap(w-20,h);a.drawOn(c,x+10,y+h-25)
            a=p(desc,'SmallE');_,ah=a.wrap(w-20,h);a.drawOn(c,x+10,y+h-34-ah)
        def arrow(x1,y1,x2,y2):
            c.setStrokeColor(ACCENT); c.setLineWidth(1.2);c.line(x1,y1,x2,y2)
            import math
            a=math.atan2(y2-y1,x2-x1)
            for d in [-.45,.45]:c.line(x2,y2,x2-6*math.cos(a+d),y2-6*math.sin(a+d))
        box(0,113,148,86,'1. FITS de IRSA','IMAGE original + posición y fecha de observación.')
        box(175,113,148,86,'2. SEP + WCS/SIP','Fondo, ruido, detecciones y centros en el cielo.')
        box(350,113,148,86,'3. Reglas de eon','Resumen, evidencias, avisos y siguiente revisión.')
        box(175,2,148,78,'Gaia + SIMBAD','Posiciones, tipos y probabilidades ya publicadas.')
        box(350,2,148,78,'Informe compartible','TXT / HTML imprimible / JSON con evidencia.')
        arrow(148,155,175,155);arrow(323,155,350,155)
        arrow(323,42,343,42);arrow(343,42,343,132);arrow(343,132,350,132)
        arrow(424,113,424,80)

title('Cómo interpreta eon', 'Método implementado · eon-evidence-rules-1 · 15 de noviembre de 2026')
body('<b>La interpretación actual es un motor de reglas explícitas.</b> Resume mediciones de imágenes reales y coincidencias de catálogo. Eon no entrena un modelo propio y no envía estas evidencias a un modelo de lenguaje para redactar conclusiones.')
story.append(Pipeline())
head('Qué hace cada pieza')
table([
    ['Pieza','Trabajo real','¿Aprendizaje automático?'],
    ['SEP 1.4.1','Detecta emisión y mide centros, formas y señal sobre los píxeles originales.','No: algoritmos clásicos de extracción.'],
    ['Gaia DSC','Aporta probabilidades de clase publicadas por Gaia, consultadas del catálogo.','Sí en su origen: modelos de Gaia, no entrenados por Eon.'],
    ['SIMBAD','Aporta nombres, posiciones y tipos compilados de fuentes astronómicas.','Eon consulta su catálogo; no entrena con él.'],
    ['Interpretación de eon','Cuenta, compara evidencias y aplica reglas versionadas; conserva ambigüedades y límites.','No hay inferencia generativa ni un clasificador propio.'],
], [95,255,149])
head('Qué significa una marca')
body('Una marca de catálogo señala una entrada de Gaia o SIMBAD. Una detección SEP procede de emisión medida en una exposición SPHEREx. Eon puede proponer que coincidan por posición, pero conserva la asociación como <b>candidata</b>: no confirma la identidad de la fuente.')
story.append(PageBreak())

title('De los píxeles a las reglas', 'El analizador trabaja sobre IMAGE; el color y el zoom de pantalla no cambian sus mediciones.')
head('1. Medir cada exposición')
body('En un Worker cancelable, SEP 1.4.1 compilado a WebAssembly estima fondo y ruido local, enmascara valores inválidos y detecta emisión conectada. Usa una malla de hasta 32 × 32 píxeles, filtro 3 × 3 y área mínima de 5 píxeles. El umbral es ajustable de 3 a 10 sigma; inicialmente es 5. No separa mezclas no resueltas.')
body('Mide el centroide, forma aparente, pico y media sobre fondo en una apertura circular de radio 2.5 píxeles. La transformación WCS/SIP pasa el centro a coordenadas ICRS. La unidad viene de BUNIT; la media en apertura <b>no es flujo integrado corregido</b>, y su error usa ruido local, sin toda la incertidumbre instrumental.')
head('2. Proponer asociaciones y agrupar fechas')
body('Las detecciones se comparan con Gaia y SIMBAD dentro de 6.15 segundos de arco, propagando movimiento propio de catálogo cuando está disponible. Varias coincidencias, o una contraparte reclamada por varias detecciones, siguen siendo ambiguas. Una coincidencia única tampoco demuestra identidad.')
body('Entre exposiciones se buscan vecinos más cercanos mutuos dentro de 6.15 segundos de arco, con margen de 1.5 segundos respecto al siguiente candidato. No se enlaza a través de una exposición fallida o vacía. Se conservan las posiciones medidas: no se inventa una trayectoria ni se demuestra movimiento físico.')
head('3. Interpretar mediante condiciones verificables')
table([
    ['Evidencia','Regla y conclusión permitida'],
    ['Una o más detecciones','Se informa el número retenido por exposición, con sus parámetros y banderas. No equivale a objetos únicos.'],
    ['Grupo en distintas fechas','Se cuenta la recurrencia posicional. Dos detectores simultáneos no son dos épocas.'],
    ['Contraparte consistente','Se describe una candidatura solo si concuerdan ID, proveedor, clase y probabilidad con el catálogo usado.'],
    ['Ambigüedad, ausencia o fallo','Se conserva sin resolver, se advierte y se propone revisar la evidencia. No se anuncia un descubrimiento.'],
], [150,349])
head('Coherencia antes de resumir')
body('El motor comprueba que región, conjunto, consulta de catálogo, ID, fecha y URL de cada exposición correspondan al mismo análisis. Datos incompatibles se excluyen con un aviso; un fallo de IRSA no se sustituye por datos sintéticos ni activa el ejemplo guardado.')
story.append(PageBreak())

title('Ejemplo real y cómo repetirlo', 'NGC 1491 · tres recortes oficiales guardados, abiertos de forma explícita.')
body('<b>Centro ICRS/J2000:</b> RA 04 h 03 m 14.63892 s; Dec +51° 20′ 25.45368″.<br/><b>En grados:</b> RA 60.8109955°; Dec 51.3404038°. Cuadrado de 0.1° (6 minutos de arco), umbral 5 sigma, detector D4.')
rows=[['Fecha de observación UTC','ID de exposición','Detecciones en la región']]
for f,n in zip(MANIFEST['frames'],[10,5,6]):
    rows.append([f['dateUtc'].replace('T',' ').replace('Z',''),f['id'],str(n)])
table(rows,[167,235,97],padding=4)
body('<b>Resultado comprobado:</b> 21 detecciones retenidas, 19 grupos y 1 grupo en tres fechas. Por detección: 5 candidaturas, 6 ambiguas y 10 sin coincidencia en las respuestas usadas. Hay 3 detecciones con banderas SEP y 1 con banderas de apertura; pueden coincidir. Estos números describen este recorte y umbral, no una precisión científica general.')
head('Un paquete que otra persona pueda revisar')
table([
    ['Archivo','Para qué sirve'],
    ['TXT','Informe legible: región, resultados, parámetros, fechas, enlaces, límites y pasos de reproducción.'],
    ['HTML / PDF','El mismo contenido, con formato autónomo y sin servicios externos. Abrir HTML → Imprimir → Guardar como PDF.'],
    ['JSON','Evidencia estructurada: filas de catálogo consultadas, grupos, mediciones, candidaturas, fallos y versión del método. Compartirlo junto al informe.'],
    ['IMAGE FITS originales','Conservar los recortes usados para revisar los píxeles. Un enlace remoto por sí solo no garantiza datos inmutables.'],
], [100,399],padding=4)
head('Pasos para repetir el ejemplo')
for s in [
    '1. En eon abre explícitamente <b>Abrir ejemplo real NGC 1491</b>. Comprueba el centro, el lado de 6 minutos y las tres fechas de la tabla.',
    '2. Espera la preparación de las imágenes. En Análisis usa umbral 5 sigma y pulsa <b>Interpretar región</b>. Revisa resultados parciales y banderas antes de comparar.',
    '3. Abre <b>Compartir informe</b> y descarga TXT o HTML. Descarga también el JSON. Los nombres de archivo contienen el centro J2000.',
    '4. En otra región usa los mismos IDs y recortes del informe. El enlace solo recupera la vista. Conserva JSON y FITS: las consultas nuevas pueden cambiar.',
]:body(s)
story.append(p('El manifiesto del ejemplo conserva URL original y SHA-256 de cada FITS y catálogo: <link href="https://eon-visualizer.pages.dev/examples/spherex/manifest.json" color="#226554">eon-visualizer.pages.dev/examples/spherex/manifest.json</link>.','SmallE'))
story.append(PageBreak())

title('Qué permite afirmar y qué falta', 'Un informe trazable de exploración; la validación instrumental sigue pendiente.')
head('Límites que acompañan siempre al resultado')
table([
    ['Tema','Estado actual'],
    ['Calidad instrumental','Sin evaluar. Solo IMAGE; no integra FLAGS/VARIANCE instrumentales ni corrección completa de PSF/apertura. Las banderas SEP son distintas.'],
    ['Movimiento físico','Sin evaluar. No ajusta trayectoria con incertidumbres completas. Una separación angular entre centroides no es movimiento propio.'],
    ['Variabilidad y espectro','Sin evaluar. La longitud de onda efectiva varía por posición/exposición. No se convierte la señal en curva de luz a banda fija ni en espectro.'],
    ['Identidad y descubrimiento','No confirmados. Una candidatura, una ausencia de coincidencia o varias fechas no bastan para identificar o descubrir una fuente.'],
    ['Cobertura y completitud','No se detecta todo. Fuentes débiles, difusas o mezcladas pueden faltar. Los recuentos dependen de la región, el umbral y los límites.'],
], [118,381])
head('Qué se ha comprobado')
body('Las pruebas contrastan SEP/WASM con SEP de Python y coordenadas con Astropy sobre FITS oficiales. Cubren centros, geometría, fondo, apertura, banderas, conservación de píxeles, exportación y coherencia de entradas. Verifican cálculos y comportamiento; <b>no miden una precisión de clasificación validada sobre SPHEREx</b>.')
body('El analizador limita el trabajo a 96 exposiciones, 2,097,152 píxeles por recorte y 500 detecciones por región/fecha. Declara fallos y omisiones. La disponibilidad de exposiciones nuevas depende de IRSA. Los canales HiPS son espectrales; las fechas individuales vienen de t_min (MJD UTC) de SIA, no necesariamente de DATE del FITS.')
head('Fuentes y código que permiten auditarlo')
refs=[
    ('Implementación y reglas de eon','https://github.com/Chompin003/eon/blob/main/docs/INTERPRETACION-REGION.md'),
    ('Mediciones, contrastes y límites de extracción','https://github.com/Chompin003/eon/blob/main/docs/ANALISIS-PIXELES.md'),
    ('SEP 1.4.1: algoritmos de extracción de fuentes','https://sep.readthedocs.io/en/stable/'),
    ('Gaia DR3: Apsis III, clasificación y probabilidades DSC','https://doi.org/10.1051/0004-6361/202243423'),
    ('IRSA: espectrofotometría SPHEREx e insumos instrumentales','https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html'),
]
for label,url in refs:
    story.append(p(f'<link href="{escape(url)}" color="#226554"><b>{label}</b></link><br/>{escape(url)}','SmallE'))

def page(canvas, doc):
    canvas.saveState(); w,h=doc.pagesize
    canvas.setFillColor(ACCENT);canvas.setFont('BodyBold',8.5)
    canvas.drawString(48,h-31,'eon  /  MÉTODO E INTERPRETACIÓN')
    canvas.setStrokeColor(LINE);canvas.line(48,42,w-48,42)
    canvas.setFont('Body',8);canvas.setFillColor(MUTED)
    canvas.drawString(48,28,'Método eon-evidence-rules-1 · 15 noviembre 2026')
    canvas.drawRightString(w-48,28,f'{doc.page} / 4')
    canvas.restoreState()

doc=SimpleDocTemplate(str(OUT),pagesize=(595.276,841.89),rightMargin=48,leftMargin=48,topMargin=57,bottomMargin=58,title='eon - Método e interpretación',author='Equipo eon')
doc.build(story,onFirstPage=page,onLaterPages=page)
print(OUT)
