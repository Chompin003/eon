# Acuerdo de trabajo — eon

Lee este archivo y `docs/COLABORACION.md` antes de editar. Estas reglas aplican a Codex, Antigravity y personas en todo el repositorio.

## Alcance y seguridad

- Explorador educativo con datos SPHEREx reales autorizados por el propietario: mosaico HiPS DR1 y exposiciones FITS de IRSA DR1/QR3. No sustituir fallos por datos sintéticos ni inventar fechas/canales.
- Nunca sobrescribas trabajo ajeno ni uses `reset --hard`, `clean -fd` o force push.
- Ejecuta `git status` antes de trabajar. No edites un checkout que otra persona o agente esté usando. Un checkout/worktree por agente.
- No subas credenciales, `.env`, `node_modules`, `dist` ni tokens. No uses servicios de pago.
- Trabaja en una rama propia y haz push. GitHub abre/actualiza el PR y lo integra automáticamente cuando pasan `quality` y `Cloudflare Pages`; no se exige aprobación humana. No uses force push ni omitas los checks.
- No delegues a otros agentes automáticamente; cada integrante administra su propia sesión.

## Propiedad de módulos

| Rama                 | Archivos principales |
| -------------------- | -------------------- |
| `feat/sky-viewer`    | `src/viewer/**`      |
| `feat/spherex-data`  | `src/data/**`        |
| `feat/drawing-tools` | `src/drawing/**`     |
| `feat/interface`     | `src/ui/**`          |

`src/shared/**`, `src/App.tsx`, configuración, dependencias, lockfile, CI y documentos requieren coordinación previa en el PR. No inventes cambios en contratos compartidos sin explicar a los otros módulos qué cambia.

## Arquitectura

- Iván (`GorditoG`) implementa coordenadas; su punto de entrada está descrito en `docs/INTEGRACION-COORDENADAS.md`. Conserva el slot `coordinateTools`, `CoordinateToolsProps` y `ViewState` en grados. El formulario futuro será RA h:m:s y Dec ±d:m:s J2000.
- Paint se monta en `drawingTools`. No sustituyas la ventana flotante para integrar estos módulos.

- `shared` no importa otros módulos; `viewer`, `data`, `drawing` y `ui` importan contratos de `shared`.
- Los módulos no se importan entre sí; `App.tsx` compone sus API públicas (`index.ts`).
- React posee la navegación ecuatorial ICRS en grados y FOV horizontal; Aladin Lite posee la proyección HiPS/FITS. Cada visor vive en un documento aislado que libera WASM, eventos y WebGL al desmontar. Three.js se conserva solo para la referencia checkerboard, cargada bajo demanda.
- Los canales espectrales del mosaico no son fechas. Las fechas individuales vienen de `t_min` (MJD UTC) de SIA; `DATE` del FITS puede ser procesamiento. Las exposiciones de un detector pueden tener longitudes de onda distintas.
- `functions/api` consulta únicamente IRSA y sirve únicamente la extensión IMAGE de recortes FITS limitados; `server` contiene helpers compartidos del backend. Conserva la WCS/SIP y los píxeles originales.
- Mantén soporte mouse, teclado y táctil, accesibilidad y diseño responsivo.

## Verificación y entrega

1. `git fetch origin` y actualiza tu rama con `origin/main` sin perder cambios locales.
2. `npm ci`, `npm run check`, `npm run build`; ejecuta `npm test` para navegación o contratos.
3. Explica cambios y comprobaciones en el PR. Adjunta captura si cambias la interfaz.
4. Comprueba que Auto integrate, CI y Pages terminan correctamente. Si falla un check o hay conflictos, corrige el problema y vuelve a subir tu rama. Los PR en borrador no se publican. Nunca compartas cuentas o sesiones de IA.
