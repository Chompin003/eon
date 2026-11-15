# Texto y símbolos en Paint

Controles → Paint → Herramientas → **T + Texto / símbolos** abre el editor desplegable. Admite hasta 500 caracteres y varias líneas, tamaño inicial/editable de 8–160 px, color y transparencia de los controles generales. El alfabeto inserta en el cursor las letras griegas y símbolos astronómicos del prototipo Python, sin fuentes remotas ni dependencias nuevas.

Guardar crea un objeto independiente en el centro del campo. Seleccionar permite moverlo y escalarlo; **Editar texto seleccionado** vuelve al editor. Con Anotar activado, el doble clic sobre el objeto también lo abre. Cancelar no modifica la escena. Ediciones, movimientos y eliminación admiten deshacer/rehacer. El borrador parcial conserva el texto; usa Seleccionar → Eliminar para quitarlo.

La geometría se almacena en coordenadas del cielo mediante la proyección activa. El texto sigue la navegación y se muestra en ambas vistas, como las demás anotaciones. El tamaño en pantalla cambia con el zoom; el texto se mantiene horizontal para lectura. PNG/JPG de Paint incluyen texto; las exportaciones generales con anotaciones usan la misma capa SVG. Los objetos permanecen en la sesión: exporta antes de cerrar.

Se reutiliza un contexto Canvas únicamente para medir texto y una caché limitada a 64 entradas para los anchos de línea. El render conserva SVG por objeto y el historial comparte referencias; no crea imágenes de cada texto ni añade consultas de red.

Validación: check, 73 pruebas unitarias, build, 43 e2e. La nueva prueba comprueba símbolos, edición, deshacer/rehacer, doble clic, transparencia, navegación y sincronía entre paneles. Se comprobó además el texto y PNG con el visor real. No se modifican IA/SEP, catálogos, contratos compartidos, dependencias ni backend.
