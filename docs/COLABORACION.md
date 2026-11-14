# Colaboración en español

## 1. Una cuenta y una carpeta por persona/agente

El propietario invita a los tres compañeros desde GitHub → repositorio → Settings → Collaborators → Add people. Cada uno acepta con su propia cuenta. No se comparten contraseñas ni sesiones de Codex/Antigravity.

Clona en una carpeta local fuera de carpetas sincronizadas (OneDrive puede causar bloqueos de archivos):

```sh
git clone https://github.com/Chompin003/spherex-explorer.git
cd spherex-explorer
git switch feat/sky-viewer
npm ci
npm run dev
```

Cada integrante elige su rama: `feat/sky-viewer`, `feat/spherex-data`, `feat/drawing-tools` o `feat/interface`. Abre su carpeta en VS Code y su propia sesión de Codex/Antigravity. No uses dos agentes sobre el mismo checkout.

Si hay varias sesiones en la misma computadora, crea worktrees desde el clon, uno por rama (la rama no puede estar abierta en otro worktree):

```sh
git worktree add ../spherex-viewer feat/sky-viewer
git worktree add ../spherex-data feat/spherex-data
git worktree add ../spherex-drawing feat/drawing-tools
git worktree add ../spherex-interface feat/interface
```

Ejecuta `npm ci` por worktree y usa un puerto diferente por servidor, por ejemplo `npm run dev -- --port 5174`. Abre cada carpeta por separado.

## 2. Rutina diaria

Con el árbol limpio (si tienes trabajo local, haz primero un commit de tu avance):

```sh
git status
git fetch origin
git pull --ff-only
git merge origin/main
```

Si hay conflictos, resuélvelos con el dueño del módulo y revisa el diff antes de continuar. No uses force push. Modifica solo tu módulo; coordina contratos, `App.tsx`, dependencias y lockfile. Los cambios remotos no aparecen solos en VS Code: debes obtenerlos con Git.

Antes de enviar:

```sh
npm run check
npm test
npm run build
git diff
git add src/viewer
git commit -m "feat(viewer): describe el cambio"
git push -u origin feat/sky-viewer
gh pr create --base main --head feat/sky-viewer --fill
```

Adapta la ruta y la rama a tu módulo. Si no tienes `gh`, abre GitHub → Pull requests → New pull request, base `main`, compare tu rama. Pide revisión a otro integrante y espera CI verde y preview de Cloudflare. Para ramas compartidas duraderas usa **Create a merge commit**, sin eliminar la rama; evita squash/rebase en estas cuatro ramas para no dejar historiales divergentes. Después de integrar, vuelve a actualizar tu rama con `origin/main`.

## 3. Live Share: trabajar juntos en una sesión

1. Todos instalan VS Code y la extensión oficial **Live Share**, identificador `ms-vsliveshare.vsliveshare` (panel Extensions; también `code --install-extension ms-vsliveshare.vsliveshare`).
2. El anfitrión abre su checkout y entra a su rama. En la paleta ejecuta **Live Share: Start Collaboration Session**, inicia sesión por el navegador y copia el enlace de invitación.
3. Comparte el enlace por el canal del equipo. Los invitados ejecutan **Live Share: Join Collaboration Session** y pegan el enlace.
4. El anfitrión inicia Vite y comparte el puerto 5173 desde el panel Live Share. No compartas terminales con permisos de escritura salvo que sea necesario.
5. En esa sesión todos editan el checkout del anfitrión: coordinen archivos y pausen los agentes independientes de ese checkout. El anfitrión revisa y realiza los commits. Al terminar usa **Stop Collaboration Session**.

Live Share no reemplaza las ramas, los PR ni las cuentas individuales; sirve para programación conjunta puntual. La sesión debe iniciarla y compartirla una persona.

## 4. Revisión y protección

`main` ya está protegida: requiere PR, al menos una aprobación, conversaciones resueltas y los checks `quality` y `Cloudflare Pages`; bloquea borrados y force pushes incluso para administradores. Un PR debe actualizarse con `main` antes de integrarlo y los nuevos commits invalidan aprobaciones anteriores. No se exige CODEOWNERS hasta registrar los usuarios reales. Las cuentas de los compañeros deben proporcionarlas ellos; no inventes invitaciones. En repositorios privados la disponibilidad de protecciones depende del plan de GitHub; no activar planes de pago.
