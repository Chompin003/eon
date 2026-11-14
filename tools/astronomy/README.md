# Entorno de astronomía

Astroquery está instalado en el entorno virtual `.venv` de este proyecto. No modifica el Python global ni se incluye en el bundle del navegador.

## Repetir la instalación

Desde la raíz del repositorio, con Python 3.13:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools/astronomy/requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe tools/astronomy/check_environment.py
```

En Linux/macOS usa `python3.13 -m venv .venv` y `.venv/bin/python` para los otros comandos. No hace falta activar el entorno para usar el ejecutable explícitamente. En VS Code selecciona `.venv/Scripts/python.exe` como intérprete.

`requirements.txt` fija las dependencias directas. `requirements-windows.lock.txt` registra todas las versiones instaladas en esta computadora Windows; úsalo para repetir exactamente ese entorno en Windows/Python 3.13. En otros sistemas usa `requirements.txt`, ya que algunas dependencias de keyring cambian por plataforma.

## Incluido

- **Astroquery 0.4.11 con `[all]`**: clientes de consulta y dependencias opcionales de archivos.
- **Astropy**: coordenadas, tablas, FITS y WCS.
- **NumPy / SciPy**: matrices y operaciones de imagen.
- **Matplotlib / Pillow**: normalización y generación/lectura de PNG.
- **PyVO**: servicios del observatorio virtual.
- Extras de Astroquery: **MOCpy, astropy-healpix, regions y boto3**.

La comprobación es offline: importa bibliotecas, comprueba coordenadas J2000 y crea un FITS y PNG sintéticos en memoria. No consulta catálogos ni descarga imágenes científicas.

## Siguiente etapa

Astroquery es un cliente de consultas, no un repositorio de todos los PNG oficiales. SPHEREx publica imágenes científicas principalmente en FITS; los previews y servicios concretos se seleccionarán usando IRSA cuando el propietario pida conectar datos reales. No se añadieron todavía consultas, descargas, credenciales ni un backend a la web.

Cloudflare Pages sigue sirviendo la aplicación Vite estática. Este entorno Python es para preparación/consulta/procesamiento de datos; no se ejecuta dentro del navegador ni aparece automáticamente en Pages.

Fuentes: [Astroquery](https://docs.astropy.org/projects/astroquery/en/stable/), [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html), [notebooks de SPHEREx](https://caltech-ipac.github.io/irsa-tutorials/spherex/).
