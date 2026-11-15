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
gh repo create eon --public --source . --remote origin --push
git push -u origin feat/sky-viewer feat/spherex-data feat/drawing-tools feat/interface
```

Ejecuta estos comandos solo desde la carpeta de este proyecto y después de que su bootstrap esté completo. Si ya hay un repositorio del mismo nombre o un remoto `origin`, inspecciónalo primero y no lo reemplaces. El repositorio público permite usar las protecciones de rama del plan gratuito; no publiques archivos ajenos o secretos.

En Settings → General → Pull Requests están habilitados **Allow auto-merge** y merge commits; las ramas duraderas no se borran automáticamente. `main` exige cero aprobaciones humanas y los checks `quality` y `Cloudflare Pages`, sin force pushes ni eliminación, incluso para administradores. No se exige actualizar la rama por cada integración ajena; los conflictos reales sí bloquean el merge. No configures pagos.

## Cloudflare: integración oficial de Git

1. Abre [Cloudflare Dashboard](https://dash.cloudflare.com/) e inicia sesión personalmente. Si no tienes cuenta, créala usando el plan gratuito.
2. Ve a **Workers & Pages → Create application → Pages → Connect to Git** (algunas versiones lo muestran como **Import an existing Git repository**).
3. Elige **GitHub** y autoriza la aplicación oficial **Cloudflare Workers and Pages**. Limita su acceso a **Only select repositories → eon**.
4. Selecciona el repositorio y configura:

| Opción                           | Valor                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| Project name                     | `eon-visualizer` |
| Production branch                | `main`                                                       |
| Framework preset                 | React (Vite) / Vite                                          |
| Build command                    | `npm run build`                                              |
| Build output directory           | `dist`                                                       |
| Root directory                   | Raíz del repositorio (vacío)                                 |
| Variable de build, si hace falta | `NODE_VERSION=24.11.1`                                       |

5. Pulsa **Save and Deploy**. Espera el estado **Success** y abre la URL `*.pages.dev` que Cloudflare asigne (no se da por creada hasta que el panel la confirme).
6. En Settings → Builds & deployments / Branch control, activa los despliegues automáticos de producción para `main` y previews para todas las ramas no productivas. No excluyas las cuatro ramas de trabajo.

El archivo `.node-version` fija Node; `public/_headers` añade cabeceras básicas y caché de assets. `eon-visualizer.pages.dev` es el destino conectado a Git. El proyecto anterior, renombrado `eon` en el panel, conserva el hostname `spherex-explorer.pages.dev`; sus builds automáticos se desactivaron al migrar para evitar despliegues duplicados. Cambiar solo el nombre del proyecto en el panel no modifica su hostname. `functions/api/observations.ts` y `functions/api/cutout.ts` se compilan automáticamente como Pages Functions durante el despliegue Git. `wrangler.jsonc` fija compatibilidad y salida; `public/_routes.json` limita las Functions a `/api/*`, manteniendo estáticos el visor y las teselas de biblioteca. No se necesitan secretos de IRSA ni un servidor Python permanente.

## Comprobar la automatización, con evidencia

Después de conectar GitHub y Pages:

1. Abre un PR de una rama de trabajo con un cambio pequeño y útil, por ejemplo corregir una instrucción de la guía.
2. Comprueba que GitHub Actions ejecuta **CI / quality** y termina verde.
3. Comprueba que la app de Cloudflare añade un deployment/check y una URL de preview al PR. Abre esa URL y prueba coordenadas, canales A/B, pantalla dividida y una exposición real por fecha. Verifica también `/api/observations?ra=60.8109955&dec=51.3404038`.
4. El workflow **Auto integrate** habilita el merge automático; GitHub lo integra al pasar los checks, sin aprobación humana.
5. En Cloudflare, comprueba que el despliegue de producción indica el mismo SHA integrado. Abre la URL pública y verifica el cambio.

Un build local correcto o la existencia de `ci.yml` no prueban que la integración remota funciona. Registra la URL pública, la URL del PR, el run de CI y el SHA desplegado en `docs/ESTADO.md`. Hasta entonces, los despliegues automáticos quedan pendientes de verificar.

## Referencias oficiales

- [Cloudflare Pages: conectar Git](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Versión de Node para el build](https://developers.cloudflare.com/pages/configuration/build-image/)
- [Protecciones de ramas en GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
