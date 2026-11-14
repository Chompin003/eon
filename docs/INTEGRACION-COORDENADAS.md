# Iván / GorditoG: integrar coordenadas en el panel

El espacio **Coordenadas · J2000** ya está dentro de la ventana flotante. El arrastre, resize, scroll, apertura y cierre los resuelve `FloatingPanel`; no es necesario modificarlos. Busca `data-module-slot="coordinates"` en `src/ui/ExplorerLayout.tsx` para localizar el hueco.

## Contrato estable

`CoordinateToolsProps` se exporta desde `src/shared/index.ts`:

```ts
interface CoordinateToolsProps {
  view: Readonly<ViewState>;
  onViewChange: (next: ViewState) => void;
}
```

`ViewState` mantiene `longitude`, `latitude` y `fov` en **grados decimales**. Para la integración ecuatorial, `longitude` corresponde a RA y `latitude` a Dec. El estado actual describe una esfera sintética; no representa una solución WCS de una imagen científica.

El formulario debe mostrar/aceptar RA h:m:s y Dec ±d:m:s, siguiendo la convención J2000 del documento E-STAR. Convierte a grados antes de llamar al callback. Conserva `view.fov` para que una búsqueda no reinicie el zoom. Los grados decimales son un formato de almacenamiento, no un cambio de sistema de coordenadas.

## Archivos y conexión

1. Trabaja en `feat/spherex-data` y actualízala con `origin/main` y con el PR del panel cuando se integre.
2. Implementa y exporta un componente `CoordinatesPanel`, por ejemplo desde `src/data/coordinates/CoordinatesPanel.tsx` y la API pública `src/data/index.ts`. Su conversor/consulta queda en ese mismo módulo. No importes `ui/` desde `data/` ni `data/` desde `ui/`.
3. En `src/App.tsx`, importa la exportación pública y añade esta prop al `ExplorerLayout` existente (hay un comentario con tu usuario en ese lugar):

```tsx
import { CoordinatesPanel } from './data';

// Dentro del ExplorerLayout que ya existe:
coordinateTools={<CoordinatesPanel view={view} onViewChange={updateView} />}
```

La prop sustituye automáticamente el marcador RA/Dec dentro de la ventana; no crea otra ventana ni otro panel. `updateView` normaliza el estado y lo comparte con Three.js. La coordenada actual vuelve al componente por `view` después de arrastrar el cielo. `drawingTools` funciona igual para quien implemente Paint.

## Precisión y límites que debes revisar

- RA: 24 h equivalen a 360° y se envuelven a 0°. Un minuto de tiempo de RA equivale a 15 minutos de arco, no a uno.
- Dec: conserva el signo como dato separado, incluso en `−00° 30′ 00″`. El ejemplo Python del documento pierde ese signo si convierte primero los grados a un entero cero.
- Valida minutos/segundos, ±90° y entradas no finitas antes de aplicar la vista. No uses texto redondeado para volver a escribir el estado numérico.
- La navegación de este prototipo limita latitud a ±85° para evitar invertir la cámara. No recortes silenciosamente coordenadas científicas de los polos: coordina ese soporte con `viewer/` antes de dar por terminada una búsqueda de todo el cielo.
- Revisa las fixtures del documento: la fila de Barnard’s Star repite coordenadas de Betelgeuse. Usa fuentes contrastadas antes de convertirlas en tests.

## Mensaje para pegar en tu Codex

```text
Soy Iván (GorditoG), responsable de coordenadas de SPHEREx Explorer.
Lee AGENTS.md, docs/INTEGRACION-COORDENADAS.md y docs/ARQUITECTURA.md.
Implementa mi módulo en mi rama, sin sustituir la ventana flotante existente.
Usa CoordinateToolsProps de shared y monta el formulario mediante la prop
coordinateTools de ExplorerLayout en App.tsx. La UI es RA h:m:s y Dec ±d:m:s
J2000; el contrato interno conserva grados decimales. Respeta el zoom actual.
Revisa los límites de polos con viewer y el signo de declinación negativa cero.
Ejecuta check, tests y build; abre PR coordinando el cambio de App.tsx.
```
