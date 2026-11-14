# Estado de la entrega — 14 de noviembre de 2026

## Listo en esta computadora

- Proyecto React + TypeScript + Vite + Three.js, organizado en cinco módulos.
- Checkerboard procedural desde el interior de la esfera, arrastre, rueda, slider, reinicio, teclado y gestos táctiles.
- Interfaz oscura responsiva, sin datos astronómicos reales ni IA.
- Git inicializado en `main` y cuatro ramas `feat/*` preparadas con la misma base del prototipo.
- Guía de colaboración, contratos, instrucciones para Live Share y `AGENTS.md`.
- Workflow de GitHub Actions preparado para instalar, validar, probar y compilar cada PR a `main`.
- Configuración estática para Cloudflare: salida `dist`, versión de Node y cabeceras.
- GitHub CLI 2.104.0 instalado en `%LOCALAPPDATA%\SPHEREx-Tools\gh\bin\gh.exe`.

## Verificado localmente

| Comprobación                                    | Resultado                                |
| ----------------------------------------------- | ---------------------------------------- |
| `npm install` y `npm ci`                        | Correctos                                |
| `npm run check`                                 | TypeScript y ESLint correctos            |
| `npm test`                                      | 5 pruebas correctas                      |
| `npm run build`                                 | Correcto                                 |
| `npm run test:e2e` sobre el build de producción | 2 pruebas correctas (escritorio y móvil) |
| `npm audit`                                     | 0 vulnerabilidades                       |
| Capturas 1440 px y 390 px                       | Revisadas visualmente                    |

Las pruebas móviles usan emulación Chromium, no un teléfono físico. Vite avisa que el chunk de Three.js mide unos 526 kB minificados (130 kB gzip); es un aviso de tamaño, no un fallo del build.

## Requiere autorización del propietario

| Entregable remoto                           | Estado real                                              |
| ------------------------------------------- | -------------------------------------------------------- |
| Repositorio GitHub `spherex-explorer`       | Pendiente de autenticar GitHub CLI y crear/subir         |
| Cuatro ramas en GitHub                      | Existen localmente; pendientes de push                   |
| Protección de `main` y revisión obligatoria | Política documentada; pendiente de aplicar en GitHub     |
| Ejecución remota de GitHub Actions          | Workflow listo; pendiente de primer push/PR              |
| Página pública Cloudflare Pages             | Pendiente de iniciar sesión y conectar GitHub            |
| Previews y despliegue automático a `main`   | Pendientes de conexión y comprobación real               |
| Acceso de los otros tres desarrolladores    | Pendiente de sus usuarios e invitaciones del propietario |
| Sesión Live Share                           | Debe iniciarla y compartirla una persona; guía preparada |

La integración de GitHub del chat está vinculada a `Chompin003`; la CLI tiene una autorización separada. El primer código de dispositivo caducó mientras el propietario estaba ausente. Hay que iniciar un nuevo `gh auth login --web` al retomar, sin compartir credenciales en el chat.

Cloudflare fue revisado en Edge y mostró `https://dash.cloudflare.com/login`; esa página quedó abierta para que el propietario inicie sesión. No se creó una cuenta ni se autorizaron permisos en su nombre.

## Retomar

1. Autorizar GitHub CLI en el navegador con la cuenta elegida.
2. Crear el repositorio sin sobrescribir uno existente, subir `main` y las cuatro ramas y aplicar protección.
3. Iniciar sesión en Cloudflare y autorizar su integración oficial solo para este repositorio.
4. Conectar Pages con `main`, `npm run build`, `dist` y Node 24.11.1.
5. Verificar producción, CI y un preview de PR siguiendo `DESPLIEGUE.md`.
6. Registrar aquí las URLs reales y el SHA desplegado. No hay todavía una URL pública ni evidencia de automatización remota.
