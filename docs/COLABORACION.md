# Colaboración en español

## Publicación automática

Por decisión del propietario, ya no se requiere aprobar cambios manualmente. Cada colaborador trabaja en su rama y ejecuta `git push`: el workflow **Auto integrate** abre o reutiliza el PR y habilita su integración al pasar **quality** y **Cloudflare Pages**. Cloudflare actualiza automáticamente la misma URL de producción. El código debe estar listo para publicarse antes de subirlo; usa un PR en borrador para trabajo que no deba publicarse.

CI se ejecuta en cada push a las ramas del repositorio, de modo que un PR creado por el bot no requiere pulsar «Approve workflows». No se ejecuta código de forks con permisos de escritura. La automatización opera sobre ramas del mismo repositorio, accesibles a los colaboradores autorizados.

Los fallos de tests/build y los conflictos de Git detienen la integración. Se conservan las comprobaciones, la protección contra force pushes y borrados, y las ramas duraderas. Las instrucciones antiguas de aprobación humana de esta guía quedan sustituidas por este flujo.

## 1. Una cuenta y una carpeta por persona/agente

El propietario invita a los tres compañeros desde GitHub → repositorio → Settings → Collaborators → Add people. Cada uno acepta con su propia cuenta. No se comparten contraseñas ni sesiones de Codex/Antigravity.

Clona en una carpeta local fuera de carpetas sincronizadas (OneDrive puede causar bloqueos de archivos):

```sh
git clone https://github.com/Chompin003/eon.git
cd eon
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
```

Adapta la ruta y la rama a tu módulo. GitHub crea el PR y lo integra automáticamente al pasar los checks. Puedes abrir un PR manualmente en GitHub si necesitas un borrador o coordinar un cambio; al marcarlo listo se habilita la integración automática. Para ramas compartidas duraderas se usa **Create a merge commit**, sin eliminar la rama; evita squash/rebase en estas cuatro ramas para no dejar historiales divergentes. Después de integrar, vuelve a actualizar tu rama con `origin/main`.

## 3. Live Share: trabajar juntos en una sesión

1. Todos instalan VS Code y la extensión oficial **Live Share**, identificador `ms-vsliveshare.vsliveshare` (panel Extensions; también `code --install-extension ms-vsliveshare.vsliveshare`).
2. El anfitrión abre su checkout y entra a su rama. En la paleta ejecuta **Live Share: Start Collaboration Session**, inicia sesión por el navegador y copia el enlace de invitación.
3. Comparte el enlace por el canal del equipo. Los invitados ejecutan **Live Share: Join Collaboration Session** y pegan el enlace.
4. El anfitrión inicia Vite y comparte el puerto 5173 desde el panel Live Share. No compartas terminales con permisos de escritura salvo que sea necesario.
5. En esa sesión todos editan el checkout del anfitrión: coordinen archivos y pausen los agentes independientes de ese checkout. El anfitrión revisa y realiza los commits. Al terminar usa **Stop Collaboration Session**.

Live Share no reemplaza las ramas, los PR ni las cuentas individuales; sirve para programación conjunta puntual. La sesión debe iniciarla y compartirla una persona.

## 4. Comprobaciones y protección

`main` requiere los checks `quality` y `Cloudflare Pages`, y está protegida contra borrados y force pushes, incluso para administradores. Se exigen cero aprobaciones humanas. Un fallo o conflicto debe corregirse en la rama de origen; luego basta hacer push otra vez. Las cuentas de los compañeros deben proporcionarlas ellos; no inventes invitaciones ni compartas credenciales. No activar planes de pago.
