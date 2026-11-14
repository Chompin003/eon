# Acuerdo de trabajo — SPHEREx Explorer

Lee este archivo y `docs/COLABORACION.md` antes de editar. Estas reglas aplican a Codex, Antigravity y personas en todo el repositorio.

## Alcance y seguridad

- Prototipo educativo: esfera checkerboard procedural, sin datos SPHEREx reales ni IA.
- Nunca sobrescribas trabajo ajeno ni uses `reset --hard`, `clean -fd` o force push.
- Ejecuta `git status` antes de trabajar. No edites un checkout que otra persona o agente esté usando. Un checkout/worktree por agente.
- No subas credenciales, `.env`, `node_modules`, `dist` ni tokens. No uses servicios de pago.
- No hagas push directo a `main` después de la inicialización. Integra mediante PR con revisión y CI verde.
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
- React posee el estado de navegación; Three.js posee recursos WebGL. Libera geometrías, materiales, eventos y animation frames al desmontar.
- Mantén soporte mouse, teclado y táctil, accesibilidad y diseño responsivo.

## Verificación y entrega

1. `git fetch origin` y actualiza tu rama con `origin/main` sin perder cambios locales.
2. `npm ci`, `npm run check`, `npm run build`; ejecuta `npm test` para navegación o contratos.
3. Explica cambios y comprobaciones en el PR. Adjunta captura si cambias la interfaz.
4. Solicita revisión a otro integrante. Nunca compartas cuentas o sesiones de IA.
