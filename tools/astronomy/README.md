# Entorno de astronomía

Astroquery está instalado en el entorno virtual `.venv` de este proyecto. No modifica el Python global ni se incluye en el bundle del navegador.

Para Hubble/Webb se añadió `query_telescopes.py` (Astroquery/MAST). La integración de comparación se verificó también con Python 3.12.14 y estos mismos requisitos fijados; véase [comparación de telescopios](../../docs/TELESCOPIOS.md) para instalación, comandos, resultados y límites. Las capas web usan Aladin/HiPS, no un servidor Python local.

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

## Consulta real y verificación

```powershell
.\.venv\Scripts\python.exe tools/astronomy/query_spherex.py --verify-first
```

Consulta exposiciones DR1/QR3 en SIA mediante Astroquery, filtra D4, guarda un manifiesto en `data-cache` y verifica con Astropy la WCS/SIP del primer recorte. Opciones: `--ra` y `--dec` en grados, `--detector 1..6`, `--max-records`, `--output`. El archivo científico se consulta con sus metadatos reales; no se usa la fecha de procesamiento como fecha de observación.

La prueba real en la posición inicial devolvió 395 filas y 60 exposiciones D4 entre 2025-08-22 y 2026-09-02. El recorte de 58×58 píxeles en MJy/sr contiene la posición solicitada; el retorno píxel→cielo→píxel coincidió a menos de 0.001″. Estos números son una comprobación de esa consulta, no cobertura universal.

Astroquery busca productos; no contiene todos los PNG ni actualiza una web automáticamente. El runtime web usa Aladin/HiPS y dos Pages Functions que hablan HTTP con SIA y el servicio de recortes. Python queda como herramienta reproducible de preparación y contraste científico. Véase [cómo funciona](../../docs/COMO-FUNCIONA.md), incluida la reproyección visual TAN-SIP.

Fuentes: [Astroquery](https://docs.astropy.org/projects/astroquery/en/stable/), [IRSA SPHEREx](https://irsa.ipac.caltech.edu/Missions/spherex.html), [notebooks de SPHEREx](https://caltech-ipac.github.io/irsa-tutorials/spherex/).
