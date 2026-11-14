# GitHub y Cloudflare Pages

## GitHub: autorización inicial

GitHub CLI se instaló de forma portable en `%LOCALAPPDATA%\SPHEREx-Tools\gh\bin\gh.exe`. Si `gh` no está en tu PATH, en PowerShell usa:

```powershell
$gh = "$env:LOCALAPPDATA\SPHEREx-Tools\gh\bin\gh.exe"
& $gh auth login --hostname github.com --git-protocol https --web
& $gh auth status
```

Autoriza en el navegador oficial con tu cuenta; no pegues contraseñas ni tokens en un chat. Un código de dispositivo caducado se sustituye ejecutando de nuevo el login. La conexión del plugin GitHub y la sesión de GitHub CLI son autorizaciones diferentes.

La cuenta conectada al plugin durante la preparación era `Chompin003`. La configuración global de Git usa otro nombre (`sentinelfoxreal`); esto no decide qué cuenta es dueña del repositorio. Confirma la cuenta de `gh` antes de crear el remoto.

Mientras no exista el repositorio, los comandos de publicación inicial son:

```sh
gh api user --jq .login
gh repo create spherex-explorer --public --source . --remote origin --push
git push -u origin feat/sky-viewer feat/spherex-data feat/drawing-tools feat/interface
```

Ejecuta estos comandos solo desde la carpeta de este proyecto y después de que su bootstrap esté completo. Si ya hay un repositorio del mismo nombre o un remoto `origin`, inspecciónalo primero y no lo reemplaces. El repositorio público permite usar las protecciones de rama del plan gratuito; no publiques archivos ajenos o secretos.

En Settings → General → Pull Requests, conserva merge commits y desmarca el borrado automático de ramas para las cuatro ramas duraderas. En Settings → Branches / Rules → añade protección para `main`: exigir PR, una aprobación, conversaciones resueltas y check `quality`, sin force pushes ni eliminación. Incluye administradores para que toda integración futura pase por revisión. No configures pagos.

## Cloudflare: integración oficial de Git

1. Abre [Cloudflare Dashboard](https://dash.cloudflare.com/) e inicia sesión personalmente. Si no tienes cuenta, créala usando el plan gratuito.
2. Ve a **Workers & Pages → Create application → Pages → Connect to Git** (algunas versiones lo muestran como **Import an existing Git repository**).
3. Elige **GitHub** y autoriza la aplicación oficial **Cloudflare Workers and Pages**. Limita su acceso a **Only select repositories → spherex-explorer**.
4. Selecciona el repositorio y configura:

| Opción                           | Valor                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Project name                     | `spherex-explorer` (si está ocupado, elegir un nombre libre) |
| Production branch                | `main`                                                       |
| Framework preset                 | React (Vite) / Vite                                          |
| Build command                    | `npm run build`                                              |
| Build output directory           | `dist`                                                       |
| Root directory                   | Raíz del repositorio (vacío)                                 |
| Variable de build, si hace falta | `NODE_VERSION=24.11.1`                                       |

5. Pulsa **Save and Deploy**. Espera el estado **Success** y abre la URL `*.pages.dev` que Cloudflare asigne (no se da por creada hasta que el panel la confirme).
6. En Settings → Builds & deployments / Branch control, activa los despliegues automáticos de producción para `main` y previews para todas las ramas no productivas. No excluyas las cuatro ramas de trabajo.

El archivo `.node-version` fija Node; `public/_headers` añade cabeceras básicas y caché de assets. No se necesita backend, dominio comprado, secreto ni token de Cloudflare para esta integración.

## Comprobar la automatización, con evidencia

Después de conectar GitHub y Pages:

1. Abre un PR de una rama de trabajo con un cambio pequeño y útil, por ejemplo corregir una instrucción de la guía.
2. Comprueba que GitHub Actions ejecuta **CI / quality** y termina verde.
3. Comprueba que la app de Cloudflare añade un deployment/check y una URL de preview al PR. Abre esa URL y prueba arrastre, slider y Reset View.
4. Obtén la aprobación de otro integrante e integra con merge commit a `main`.
5. En Cloudflare, comprueba que el despliegue de producción indica el mismo SHA integrado. Abre la URL pública y verifica el cambio.

Un build local correcto o la existencia de `ci.yml` no prueban que la integración remota funciona. Registra la URL pública, la URL del PR, el run de CI y el SHA desplegado en `docs/ESTADO.md`. Hasta entonces, los despliegues automáticos quedan pendientes de verificar.

## Referencias oficiales

- [Cloudflare Pages: conectar Git](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Versión de Node para el build](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Protecciones de ramas en GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
