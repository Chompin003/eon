/* global performance, customElements, HTMLElement, document, AbortController, requestAnimationFrame, cancelAnimationFrame, ResizeObserver, FileReader, Image, URL, Blob, XMLSerializer, devicePixelRatio, setTimeout */
/* Controles aislados en Shadow DOM; target debe ser un SVG de la página. */
import M from './paint-model.js';
(() => {
  'use strict';
  if (customElements.get('spherex-paint')) return;

  const NS = 'http://www.w3.org/2000/svg';
  // Unicode nativo, sin imágenes remotas ni librerías. El panel se construye al abrirlo.
  const emojiGroups = [
    {
      name: 'Caras',
      items: [
        ['😀', 'sonrisa'],
        ['😃', 'alegría'],
        ['😄', 'risa'],
        ['😁', 'sonrisa grande'],
        ['😆', 'risa ojos cerrados'],
        ['🥹', 'emoción'],
        ['😅', 'sudor sonrisa'],
        ['😂', 'lágrimas risa'],
        ['🤣', 'carcajada'],
        ['🥲', 'sonrisa lágrima'],
        ['☺️', 'sonriente'],
        ['😊', 'feliz'],
        ['😇', 'ángel'],
        ['🙂', 'sonrisa suave'],
        ['🙃', 'al revés'],
        ['😉', 'guiño'],
        ['😌', 'alivio'],
        ['😍', 'enamorado'],
        ['🥰', 'corazones'],
        ['😘', 'beso corazón'],
        ['😗', 'beso'],
        ['😙', 'beso sonriente'],
        ['😚', 'beso ojos cerrados'],
        ['😋', 'delicioso'],
        ['😛', 'lengua'],
        ['😝', 'lengua ojos cerrados'],
        ['😜', 'guiño lengua'],
        ['🤪', 'loco'],
        ['🤨', 'ceja levantada'],
        ['🧐', 'monóculo'],
        ['🤓', 'gafas'],
        ['😎', 'gafas sol'],
        ['🥸', 'disfraz'],
        ['🤩', 'estrellas ojos'],
        ['🥳', 'fiesta'],
        ['😏', 'sonrisa pícara'],
        ['😒', 'descontento'],
        ['😞', 'decepción'],
        ['😔', 'triste'],
        ['😟', 'preocupación'],
        ['😕', 'confusión'],
        ['🙁', 'tristeza'],
        ['☹️', 'ceño fruncido'],
        ['😣', 'frustración'],
        ['😖', 'disgusto'],
        ['😫', 'cansado'],
        ['😩', 'agotado'],
        ['🥺', 'súplica'],
        ['😢', 'llanto'],
        ['😭', 'llorando'],
        ['😤', 'resoplido'],
        ['😠', 'enfado'],
        ['😡', 'furia'],
        ['🤬', 'maldición'],
        ['🤯', 'mente explosión'],
        ['😳', 'sorpresa'],
        ['🥵', 'calor'],
        ['🥶', 'frío'],
        ['😱', 'grito'],
        ['😨', 'miedo'],
        ['😰', 'ansiedad'],
        ['😥', 'sudor triste'],
        ['😓', 'sudor'],
        ['🤗', 'abrazo'],
        ['🤔', 'pensando'],
        ['🫣', 'mirar escondido'],
        ['🤭', 'risa oculta'],
        ['🫢', 'asombro'],
        ['🫡', 'saludo'],
        ['🤫', 'silencio'],
        ['🫠', 'derretido'],
        ['🤥', 'mentira'],
        ['😶', 'sin boca'],
        ['😐', 'neutral'],
        ['😑', 'inexpresivo'],
        ['😬', 'mueca'],
        ['🙄', 'ojos arriba'],
        ['😮', 'sorprendido'],
        ['😯', 'asombrado'],
        ['😲', 'increíble'],
        ['🥱', 'bostezo'],
        ['😴', 'dormido'],
        ['🤤', 'baba'],
        ['😵', 'mareado'],
        ['🤐', 'boca cerrada'],
        ['🤢', 'náusea'],
        ['🤮', 'vómito'],
        ['🤧', 'estornudo'],
        ['😷', 'mascarilla'],
        ['🤒', 'enfermo'],
        ['🤕', 'herido'],
        ['🤑', 'dinero'],
        ['🤠', 'vaquero'],
        ['😈', 'diablo'],
        ['👻', 'fantasma'],
        ['💀', 'calavera'],
        ['🤖', 'robot'],
        ['👽', 'alienígena'],
        ['😺', 'gato sonriente'],
        ['😻', 'gato enamorado'],
      ],
    },
    {
      name: 'Gestos',
      items: [
        ['👍', 'bien'],
        ['👎', 'mal'],
        ['👋', 'hola'],
        ['✋', 'mano'],
        ['👌', 'correcto'],
        ['✌️', 'paz'],
        ['🤞', 'suerte'],
        ['🤟', 'amor gesto'],
        ['🤘', 'rock'],
        ['🤙', 'llamada'],
        ['👈', 'izquierda'],
        ['👉', 'derecha'],
        ['👆', 'arriba'],
        ['👇', 'abajo'],
        ['☝️', 'índice'],
        ['👏', 'aplausos'],
        ['🙌', 'celebración'],
        ['🤝', 'acuerdo'],
        ['🙏', 'gracias'],
        ['💪', 'fuerza'],
        ['👀', 'ojos'],
        ['🧠', 'cerebro'],
      ],
    },
    {
      name: 'Espacio',
      items: [
        ['⭐', 'estrella'],
        ['🌟', 'estrella brillante'],
        ['✨', 'destellos'],
        ['💫', 'órbita'],
        ['☀️', 'sol'],
        ['🌞', 'sol sonriente'],
        ['🌙', 'luna'],
        ['🌕', 'luna llena'],
        ['🌑', 'luna nueva'],
        ['🌒', 'luna creciente'],
        ['🌓', 'cuarto creciente'],
        ['🌔', 'luna gibosa'],
        ['🌖', 'luna menguante'],
        ['🌗', 'cuarto menguante'],
        ['🌘', 'luna fina'],
        ['🪐', 'saturno planeta'],
        ['🌍', 'tierra europa'],
        ['🌎', 'tierra américa'],
        ['🌏', 'tierra asia'],
        ['🚀', 'cohete'],
        ['🛸', 'ovni'],
        ['🛰️', 'satélite'],
        ['🔭', 'telescopio'],
        ['☄️', 'cometa'],
        ['🌌', 'galaxia'],
        ['🌠', 'estrella fugaz'],
      ],
    },
    {
      name: 'Símbolos',
      items: [
        ['❤️', 'corazón rojo'],
        ['🧡', 'corazón naranja'],
        ['💛', 'corazón amarillo'],
        ['💚', 'corazón verde'],
        ['💙', 'corazón azul'],
        ['💜', 'corazón morado'],
        ['🤍', 'corazón blanco'],
        ['🔥', 'fuego'],
        ['💡', 'idea'],
        ['📍', 'ubicación'],
        ['📌', 'chincheta'],
        ['🎯', 'objetivo'],
        ['⭕', 'círculo'],
        ['❌', 'cruz'],
        ['✅', 'comprobado'],
        ['⚠️', 'aviso'],
        ['❓', 'pregunta'],
        ['❗', 'exclamación'],
        ['➕', 'más'],
        ['➖', 'menos'],
        ['➡️', 'flecha derecha'],
        ['⬅️', 'flecha izquierda'],
        ['⬆️', 'flecha arriba'],
        ['⬇️', 'flecha abajo'],
        ['🎉', 'confeti'],
        ['🏆', 'trofeo'],
        ['👑', 'corona'],
        ['🎵', 'música'],
        ['⚡', 'rayo'],
      ],
    },
    {
      name: 'Naturaleza',
      items: [
        ['🐶', 'perro'],
        ['🐱', 'gato'],
        ['🐭', 'ratón'],
        ['🐰', 'conejo'],
        ['🦊', 'zorro'],
        ['🐻', 'oso'],
        ['🐼', 'panda'],
        ['🐸', 'rana'],
        ['🦋', 'mariposa'],
        ['🐝', 'abeja'],
        ['🌸', 'flor'],
        ['🌻', 'girasol'],
        ['🌹', 'rosa'],
        ['🌲', 'árbol'],
        ['🌵', 'cactus'],
        ['🍀', 'trébol'],
        ['🍎', 'manzana'],
        ['🍓', 'fresa'],
        ['🍕', 'pizza'],
        ['☕', 'café'],
      ],
    },
  ];
  const paths = {
    pencil: '<path d="m4 16 1-5L15 1l4 4L9 15zM12 4l4 4M4 16l4-1"/>',
    line: '<path d="M3 17 17 3"/><circle cx="3" cy="17" r="1"/><circle cx="17" cy="3" r="1"/>',
    rect: '<rect x="3" y="4" width="14" height="12" rx="1"/>',
    ellipse: '<ellipse cx="10" cy="10" rx="7" ry="6"/>',
    eraser: '<path d="m3 11 8-8 7 7-8 8H7zM7 7l7 7M10 18h8"/>',
    select: '<path d="m4 2 12 9-6 1-3 6z"/>',
    undo: '<path d="m7 3-4 4 4 4M3 7h8a6 6 0 0 1 0 12"/>',
    redo: '<path d="m13 3 4 4-4 4M17 7H9a6 6 0 0 0 0 12"/>',
    image:
      '<rect x="2" y="3" width="16" height="14" rx="2"/><circle cx="7" cy="7" r="1"/><path d="m3 15 5-5 3 3 3-5 4 6"/>',
    trash: '<path d="M3 5h14M7 5V2h6v3M5 5l1 13h8l1-13M8 8v7M12 8v7"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[name]}</svg>`;
  const svg = (name, attrs = {}) => {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };

  class PaintWidget extends HTMLElement {
    constructor() {
      super();
      this.history = new M.History();
      this.surfaces = new Map();
      this.enabled = false;
      this.visible = true;
      this.center = { ra: 180, dec: 0 };
      this.textContext = document.createElement('canvas').getContext('2d');
      this.textMetrics = new Map();
      this.options = { tool: 'pencil', color: '#86e1ce', width: 4, opacity: 1, fill: false };
      this.selected = null;
      this.gesture = null;
      this.nextId = 1;
      this.nodeCache = new WeakMap();
      this.pathCache = new WeakMap();
      this.instanceId = `paint-${PaintWidget.nextInstance++}`;
      this.attachShadow({ mode: 'open' }).innerHTML = `
      <style>
        :host { display:block; width:100%; max-width:100%; color:#37352f; font:13px/1.5 system-ui,sans-serif; color-scheme:light; }
        * { box-sizing:border-box; } details { background:#fbfbfa; border:1px solid #dededb; border-radius:6px; overflow:hidden; }
        summary { padding:9px 8px; display:flex; gap:12px; align-items:center; cursor:pointer; list-style:none; }
        summary::-webkit-details-marker { display:none; } .badge { width:32px; height:32px; display:grid; place-items:center; color:#86e1ce; border:1px solid #42636a; border-radius:9px; }
        .title { flex:1; font-weight:600; } .title small { display:block; font-size:10px; font-weight:400; letter-spacing:.05em; color:#787774; } .chevron { color:#787774; } details[open] .chevron { transform:rotate(180deg); }
        .panel { padding:10px 8px; border-top:1px solid #e9e9e7; } .toolbar { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:5px; }
        button { font:inherit; cursor:pointer; color:inherit; background:#ffffff; border:1px solid #dededb; border-radius:7px; min-height:36px; padding:7px; }
        button:hover { background:#eeeeeb; } button[aria-pressed=true] { color:#10252a; background:#86e1ce; border-color:#86e1ce; } button:disabled { opacity:.35; cursor:default; }
        button:focus-visible, summary:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid #86e1ce; outline-offset:2px; }
        svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; display:block; margin:auto; }
        .row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:13px; } .row label { display:flex; align-items:center; gap:7px; font-size:12px; } .row input[type=color] { border:1px solid #dededb; padding:2px; width:40px; height:30px; background:#ffffff; border-radius:5px; cursor:pointer; }
        .slider-label { display:flex; justify-content:space-between; margin:15px 0 5px; font-size:12px; } output { color:#286342; font-variant-numeric:tabular-nums; }
        input[type=range] { width:100%; margin:0; accent-color:#86e1ce; cursor:pointer; } input[type=checkbox] { accent-color:#86e1ce; }
        .help { font-size:11px; color:#787774; margin:11px 0 0; } .actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:13px; } .actions button { display:flex; align-items:center; gap:5px; font-size:11px; flex:1; }
        .actions svg { margin:0; width:15px; height:15px; flex-shrink:0; } select { background:#ffffff; border:1px solid #dededb; border-radius:6px; color:inherit; padding:6px; max-width:100%; }
        .export button { flex:1; color:#286342; } #status { color:#286342; font-size:11px; margin:10px 0 0; } #status:empty { display:none; }
        .preview { height:16px; margin-top:10px; display:flex; align-items:center; justify-content:center; } .preview span { display:block; width:90%; border-radius:50px; }
        #emoji-picker { margin-top:13px; border:1px solid #dededb; border-radius:8px; background:#ffffff; }
        #emoji-picker>summary { padding:10px; font-size:12px; justify-content:space-between; }
        .emoji-body { padding:0 9px 10px; } .emoji-body input { width:100%; padding:8px; color:inherit; background:#f3f3f0; border:1px solid #dededb; border-radius:5px; font:inherit; }
        .emoji-categories { display:flex; gap:4px; flex-wrap:wrap; margin:8px 0; } .emoji-categories button { min-height:26px; padding:3px 6px; font-size:10px; }
        .emoji-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); max-height:224px; overflow:auto; overscroll-behavior:contain; scrollbar-width:thin; gap:2px; align-content:start; }
        .emoji-grid button { padding:3px 0; min-height:34px; border:0; background:transparent; font:24px/1.2 'Segoe UI Emoji','Apple Color Emoji',sans-serif; }
        .emoji-grid button:hover,.emoji-grid button:focus-visible { background:#e0eceb; }
        #emoji-empty { font-size:11px; color:#787774; }
        #text-form { display:grid; gap:8px; padding:10px 0; }
        #text-value { width:100%; box-sizing:border-box; resize:vertical; min-height:64px; background:#ffffff; color:#37352f; border:1px solid #dededb; border-radius:6px; padding:8px; font:14px system-ui; }
        #space-alphabet { display:grid; grid-template-columns:repeat(8,1fr); gap:3px; }
        #space-alphabet button { padding:4px 0; font:18px 'Segoe UI Symbol',sans-serif; }
        #new-text,#edit-text { width:100%; margin-top:8px; }
      </style>
      <details>
        <summary><span class="badge">${icon('pencil')}</span><span class="title">Herramientas<small>ANOTACIONES DE ESTUDIO</small></span><span class="chevron" aria-hidden="true">⌄</span></summary>
        <div class="panel">
          <div class="row"><label><input id="enabled" type="checkbox"> Anotar (bloquea arrastre del cielo)</label></div>
          <div class="row"><label><input id="visible" type="checkbox" checked> Mostrar anotaciones</label></div>
          <div class="toolbar" role="group" aria-label="Herramientas de Paint">
            ${[
              ['pencil', 'Lápiz'],
              ['line', 'Línea'],
              ['rect', 'Rectángulo'],
              ['ellipse', 'Elipse'],
              ['eraser', 'Borrador parcial'],
              ['select', 'Seleccionar, mover y escalar'],
            ]
              .map(
                ([key, label]) =>
                  `<button type="button" data-tool="${key}" title="${label}" aria-label="${label}" aria-pressed="${key === 'pencil'}">${icon(key)}</button>`,
              )
              .join('')}
          </div>
          <p id="tool-help" class="help">Lápiz: arrastra sobre el lienzo para dibujar.</p>
          <div class="row"><label for="color">Color <input id="color" type="color" value="#86e1ce"></label><label><input id="fill" type="checkbox"> Rellenar</label></div>
          <label class="slider-label" for="width">Grosor <output id="width-value" for="width">4 px</output></label>
          <input id="width" type="range" min="1" max="50" value="4">
          <label class="slider-label" for="transparency">Transparencia <output id="transparency-value" for="transparency">0 %</output></label>
          <input id="transparency" type="range" min="0" max="100" value="0">
          <div class="preview" aria-hidden="true"><span></span></div>
          <div class="actions"><button type="button" id="undo" title="Deshacer (Ctrl+Z)">${icon('undo')}Deshacer</button><button type="button" id="redo" title="Rehacer (Ctrl+Y)">${icon('redo')}Rehacer</button></div>
          <div class="actions"><button type="button" id="image">${icon('image')}Imagen</button><button type="button" id="delete">${icon('trash')}Eliminar</button></div>
          <input id="file" type="file" accept="image/png,image/jpeg" hidden>
          <button type="button" id="new-text">T + Texto / símbolos</button>
          <button type="button" id="edit-text" disabled>Editar texto seleccionado</button>
          <details id="text-editor"><summary>Texto y alfabeto espacial</summary>
            <form id="text-form">
              <label for="text-value">Texto</label>
              <textarea id="text-value" maxlength="500" rows="3" placeholder="Ej.: α Centauri · λ = 2 μm"></textarea>
              <label for="text-size">Tamaño del texto <output id="text-size-value">24 px</output></label>
              <input id="text-size" type="range" min="8" max="160" value="24">
              <div id="space-alphabet" role="group" aria-label="Letras griegas y símbolos astronómicos"></div>
              <p class="help">Usa el color y la transparencia de Paint. Doble clic sobre el texto para editarlo.</p>
              <div class="actions"><button type="submit">Guardar texto</button><button type="button" id="cancel-text">Cancelar texto</button></div>
            </form>
          </details>
          <details id="emoji-picker"><summary>😀 Emojis <span aria-hidden="true">⌄</span></summary><div class="emoji-body"><input id="emoji-search" type="search" placeholder="Buscar emoji…" aria-label="Buscar emoji" autocomplete="off"><div class="emoji-categories" role="group" aria-label="Categorías de emojis"></div><div class="emoji-grid" role="group" aria-label="Emojis predefinidos"></div><p id="emoji-empty" hidden>Sin coincidencias.</p></div></details>
          <div class="row"><button type="button" id="clear">Limpiar anotaciones</button></div>
          <div class="actions export"><button type="button" id="png">Exportar PNG</button><button type="button" id="jpg">Exportar JPG</button></div>
          <p class="help">Capa de estudio en RA/Dec, independiente de los datos SPHEREx. Desactiva Anotar para navegar. PNG/JPG exportan solo las anotaciones, sin los píxeles científicos. Guarda antes de cerrar: los dibujos viven en esta sesión.</p>
          <p class="help">Selecciona un objeto para moverlo; arrastra sus esquinas para escalar. Supr elimina. Ctrl+Z / Ctrl+Y en el lienzo.</p>
          <p id="status" role="status" aria-live="polite" aria-atomic="true"></p>
        </div>
      </details>`;
    }

    connectedCallback() {
      if (this.abort) return;
      this.abort = new AbortController();
      const listen = (target, type, fn, opts = {}) =>
        target.addEventListener(type, fn, { ...opts, signal: this.abort.signal });
      const root = this.shadowRoot;
      root.querySelector('details').open = false;
      listen(root.getElementById('enabled'), 'change', (event) => {
        this.cancel();
        this.enabled = event.target.checked;
        this.draw();
        this.say(
          this.enabled
            ? 'Anotación activa. Desactívala para mover el cielo.'
            : 'Modo navegar: el mapa recibe los gestos.',
        );
      });
      listen(root.getElementById('visible'), 'change', (event) => {
        this.cancel();
        this.visible = event.target.checked;
        this.draw();
      });
      root
        .querySelectorAll('[data-tool]')
        .forEach((button) => listen(button, 'click', () => this.setTool(button.dataset.tool)));
      ['color', 'width', 'transparency', 'fill'].forEach((id) => {
        listen(root.getElementById(id), 'input', () => {
          this.options.color = root.getElementById('color').value;
          this.options.width = Number(root.getElementById('width').value);
          this.options.opacity = 1 - Number(root.getElementById('transparency').value) / 100;
          this.options.fill = root.getElementById('fill').checked;
          this.updateControls();
        });
        listen(root.getElementById(id), 'change', () => {
          if (root.getElementById('text-editor').open) return;
          if (this.selected !== null)
            this.change(
              this.history.items.map((item) =>
                item.id === this.selected
                  ? {
                      ...item,
                      color: this.options.color,
                      width: this.options.width,
                      opacity: this.options.opacity,
                      fill: this.options.fill,
                    }
                  : item,
              ),
            );
        });
      });
      const click = (id, fn) => listen(root.getElementById(id), 'click', fn);
      click('new-text', () => this.openText());
      click('edit-text', () =>
        this.openText(this.history.items.find((item) => item.id === this.selected)),
      );
      click('cancel-text', () => {
        root.getElementById('text-editor').open = false;
        this.editTextId = null;
      });
      listen(root.getElementById('text-form'), 'submit', (event) => {
        event.preventDefault();
        this.saveText();
      });
      listen(root.getElementById('text-size'), 'input', (event) => {
        root.getElementById('text-size-value').textContent = event.target.value + ' px';
      });
      const alphabet = 'α β γ δ ε θ λ μ π σ φ ω Δ Σ Π Ω ∞ ± ≠ ≈ ≤ ≥ √ ∫ ° ★ ✦ ☄ ☾ ☼ ⊕ 🌌'.split(
        ' ',
      );
      root.getElementById('space-alphabet').replaceChildren(
        ...alphabet.map((symbol) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = symbol;
          button.setAttribute('aria-label', 'Insertar símbolo ' + symbol);
          listen(button, 'click', () => {
            const input = root.getElementById('text-value');
            if (
              input.value.length - (input.selectionEnd - input.selectionStart) + symbol.length <=
              500
            )
              input.setRangeText(symbol, input.selectionStart, input.selectionEnd, 'end');
            input.focus();
          });
          return button;
        }),
      );
      click('undo', () => this.undo());
      click('redo', () => this.redo());
      click('delete', () => this.removeSelected());
      click('clear', () => {
        if (this.history.items.length) {
          this.change([]);
          this.say('Lienzo limpio. Puedes deshacer.');
        }
      });
      click('image', () => root.getElementById('file').click());
      listen(root.getElementById('file'), 'change', (event) =>
        this.importImage(event.target.files[0]),
      );
      listen(root.getElementById('emoji-picker'), 'toggle', (event) => {
        if (event.target.open && !this.emojiReady) this.initEmojis(listen);
      });
      click('png', () => this.exportImage('png'));
      click('jpg', () => this.exportImage('jpeg'));
      listen(root, 'keydown', (event) => {
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) this.key(event);
      });
      this.updateControls();
      this.draw();
    }
    disconnectedCallback() {
      this.cancel();
      if (this.drawFrame) cancelAnimationFrame(this.drawFrame);
      this.drawFrame = 0;
      this.abort?.abort();
      this.abort = null;
      this.emojiReady = false;
    }
    flushPointer() {
      if (this.pointerFrame) cancelAnimationFrame(this.pointerFrame);
      this.pointerFrame = 0;
      const latest = this.pendingPointer;
      this.pendingPointer = null;
      if (latest && this.gesture) this.movePointer(latest);
    }
    initEmojis(listen) {
      this.emojiReady = true;
      this.emojiCategory = 0;
      const root = this.shadowRoot,
        categories = root.querySelector('.emoji-categories'),
        grid = root.querySelector('.emoji-grid');
      categories.replaceChildren(
        ...emojiGroups.map((group, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = group.name;
          button.setAttribute('aria-pressed', index === 0);
          listen(button, 'click', () => {
            this.emojiCategory = index;
            root.getElementById('emoji-search').value = '';
            this.renderEmojis();
          });
          return button;
        }),
      );
      listen(root.getElementById('emoji-search'), 'input', () => this.renderEmojis());
      listen(grid, 'click', (event) => {
        const button = event.target.closest('[data-emoji]');
        if (!button) return;
        if (!this.projection) {
          this.say('Espera a que cargue el visor.');
          return;
        }
        const size = this.view.width * 0.07,
          top = M.clamp(-this.center.dec - size / 2, -90, 90 - size),
          item = this.newItem('emoji', [
            { x: this.center.ra - size / 2, y: top },
            { x: this.center.ra + size / 2, y: top + size },
          ]);
        item.text = button.textContent;
        this.change([...this.history.items, item]);
        this.setTool('select');
        this.selected = item.id;
        this.draw();
        this.say(`Emoji ${button.title} añadido.`);
      });
      listen(grid, 'keydown', (event) => {
        const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
        if (!(event.key in steps)) return;
        const buttons = Array.from(grid.querySelectorAll('button')),
          index = buttons.indexOf(event.target);
        if (index >= 0) {
          event.preventDefault();
          buttons[M.clamp(index + steps[event.key], 0, buttons.length - 1)]?.focus();
        }
      });
      this.renderEmojis();
    }
    renderEmojis() {
      const root = this.shadowRoot,
        normalize = (value) =>
          value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase(),
        query = normalize(root.getElementById('emoji-search').value.trim());
      root
        .querySelectorAll('.emoji-categories button')
        .forEach((button, index) =>
          button.setAttribute('aria-pressed', !query && index === this.emojiCategory),
        );
      const items = query
        ? emojiGroups
            .flatMap((group) => group.items)
            .filter(([emoji, name]) => normalize(name).includes(query) || emoji === query)
        : emojiGroups[this.emojiCategory].items;
      const grid = root.querySelector('.emoji-grid');
      grid.replaceChildren(
        ...items.map(([emoji, name]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = emoji;
          button.title = name;
          button.setAttribute('aria-label', `Insertar ${name}`);
          button.dataset.emoji = 'true';
          return button;
        }),
      );
      grid.scrollTop = 0;
      root.getElementById('emoji-empty').hidden = items.length > 0;
    }
    openText(item) {
      this.cancel();
      this.editTextId = item?.type === 'text' ? item.id : null;
      const root = this.shadowRoot,
        box = item ? this.pixelBounds(this.projectedPoints(item)) : null;
      root.getElementById('text-editor').open = true;
      root.getElementById('text-value').value = this.editTextId !== null ? item.text : '';
      const size = box
        ? M.clamp(Math.round(box.height / (item.text.split('\n').length * 1.3)), 8, 160)
        : 24;
      root.getElementById('text-size').value = size;
      root.getElementById('text-size-value').textContent = size + ' px';
      if (item) {
        this.selected = item.id;
        this.adoptStyle(item);
        this.draw();
      }
      root.getElementById('text-value').focus();
    }
    saveText() {
      const root = this.shadowRoot,
        text = root.getElementById('text-value').value.trim();
      if (!text) {
        this.say('Escribe un texto antes de guardar.');
        return;
      }
      if (!this.projection) {
        this.say('Espera a que cargue el visor.');
        return;
      }
      const size = Number(root.getElementById('text-size').value),
        lines = text.split('\n');
      const context = this.textContext;
      context.font = 'bold ' + size + 'px "Segoe UI",sans-serif';
      const width = Math.max(12, ...lines.map((line) => context.measureText(line).width)),
        height = size * 1.3 * lines.length;
      const original = this.history.items.find(
        (item) => item.id === this.editTextId && item.type === 'text',
      );
      const old = original ? M.bounds(original) : null;
      const center = old
        ? this.projection.worldToPixel(M.wrapRA(old.x + old.width / 2), -(old.y + old.height / 2))
        : this.projection.getSize().map((v) => v / 2);
      if (!center) {
        this.say('Centra el texto en el visor para editarlo.');
        return;
      }
      const points = [
        [-1, -1],
        [1, 1],
      ].map(([x, y]) => {
        const w = this.projection.pixelToWorld(
          center[0] + (x * width) / 2,
          center[1] + (y * height) / 2,
        );
        return w ? { x: M.nearRA(w[0], this.center.ra), y: -w[1] } : { x: NaN, y: NaN };
      });
      if (!points.every(M.isSkyPoint)) {
        this.say('Reduce el tamaño del texto para que quepa en el campo.');
        return;
      }
      const item = { ...this.newItem('text', points), text };
      if (original) item.id = original.id;
      this.change(
        original
          ? this.history.items.map((el) => (el.id === original.id ? item : el))
          : [...this.history.items, item],
      );
      this.setTool('select');
      this.selected = item.id;
      this.draw();
      this.editTextId = null;
      root.getElementById('text-editor').open = false;
      this.say(original ? 'Texto actualizado.' : 'Texto añadido. Puedes moverlo y escalarlo.');
    }
    say(message) {
      this.shadowRoot.getElementById('status').textContent = message;
    }
    setTool(tool) {
      this.cancel();
      this.options.tool = tool;
      this.selected = null;
      this.shadowRoot
        .querySelectorAll('[data-tool]')
        .forEach((button) => button.setAttribute('aria-pressed', button.dataset.tool === tool));
      const hints = {
        pencil: 'Lápiz: arrastra sobre el lienzo para dibujar.',
        line: 'Línea: arrastra entre el inicio y el final.',
        rect: 'Rectángulo: arrastra entre dos esquinas.',
        ellipse: 'Elipse: arrastra para definir su tamaño.',
        eraser:
          'Borrador parcial: elimina solo por donde pasas. Grosor = diámetro del borrador. Supr elimina el objeto completo.',
        select: 'Selecciona un objeto para moverlo o escalarlo desde sus esquinas.',
      };
      this.shadowRoot.getElementById('tool-help').textContent = hints[tool];
      for (const { board } of this.surfaces.values())
        board.style.cursor = tool === 'select' ? 'default' : 'crosshair';
      this.draw();
    }
    newItem(type, points) {
      return {
        id: this.nextId++,
        type,
        points,
        color: this.options.color,
        width: this.options.width,
        opacity: this.options.opacity,
        fill: this.options.fill,
      };
    }
    adoptStyle(item) {
      const root = this.shadowRoot;
      for (const key of ['color', 'width', 'opacity', 'fill']) this.options[key] = item[key];
      root.getElementById('color').value = item.color;
      root.getElementById('width').value = item.width;
      root.getElementById('transparency').value = Math.round((1 - item.opacity) * 100);
      root.getElementById('fill').checked = item.fill;
    }
    updateControls() {
      const root = this.shadowRoot;
      root.getElementById('width-value').value = `${this.options.width} px`;
      root.getElementById('transparency-value').value =
        `${Math.round((1 - this.options.opacity) * 100)} %`;
      const preview = root.querySelector('.preview span');
      preview.style.height = `${Math.min(this.options.width, 16)}px`;
      preview.style.background = this.options.color;
      preview.style.opacity = this.options.opacity;
      root.getElementById('undo').disabled = !this.history.past.length;
      root.getElementById('redo').disabled = !this.history.future.length;
      root.getElementById('edit-text').disabled = !this.history.items.some(
        (item) => item.id === this.selected && item.type === 'text',
      );
      root.getElementById('delete').disabled = !this.history.items.some(
        (item) => item.id === this.selected,
      );
      ['clear', 'png', 'jpg'].forEach((id) => {
        root.getElementById(id).disabled = !this.history.items.length;
      });
    }
    change(items) {
      this.history.commit(items);
      if (!items.some((item) => item.id === this.selected)) this.selected = null;
      this.draw();
    }
    undo() {
      this.cancel();
      if (this.history.undo()) {
        this.selected = null;
        this.draw();
        this.say('Acción deshecha.');
      }
    }
    redo() {
      this.cancel();
      if (this.history.redo()) {
        this.selected = null;
        this.draw();
        this.say('Acción rehecha.');
      }
    }
    removeSelected() {
      if (this.selected !== null)
        this.change(this.history.items.filter((item) => item.id !== this.selected));
    }
    key(event) {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) this.redo();
        else this.undo();
      } else if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        this.redo();
      } else if (event.key === 'Escape') {
        this.cancel();
        this.selected = null;
        this.draw();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.removeSelected();
      } else if (
        this.selected !== null &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault();
        const step = (this.view.width / this.board.clientWidth) * (event.shiftKey ? 10 : 1);
        // North-up astronomical images have east/RA toward screen-left.
        const dx = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        const items = this.history.items.map((item) =>
          item.id === this.selected ? M.move(item, dx, dy) : item,
        );
        if (items.every((item) => item.points.every(M.isSkyPoint))) this.change(items);
      }
    }
    point(event) {
      const rect = this.board.getBoundingClientRect();
      const sky = this.projection.pixelToWorld(event.clientX - rect.left, event.clientY - rect.top);
      return sky && sky.every(Number.isFinite)
        ? { x: M.nearRA(sky[0], this.center.ra), y: -sky[1] }
        : { x: NaN, y: NaN };
    }
    itemAt(event) {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-item]');
      if (target && this.board.contains(target)) return Number(target.getAttribute('data-item'));
      const p = this.point(event);
      for (const item of [...this.history.items].reverse()) {
        if (item.type !== 'text') continue;
        const b = M.bounds(item),
          x = p.x - M.offsetFor(item, this.center.ra);
        if (x >= b.x && x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height) return item.id;
      }
      return null;
    }
    down(event) {
      if (!this.enabled || !this.visible || this.gesture || event.button !== 0) return;
      this.board.focus({ preventScroll: true });
      const point = this.point(event);
      if (!M.isSkyPoint(point)) {
        this.say('Fuera del rango de declinación −90° a +90°.');
        return;
      }
      const candidate = this.history.items.find((item) => item.id === this.itemAt(event));
      const now = performance.now();
      if (
        this.options.tool === 'select' &&
        candidate?.type === 'text' &&
        !event.target.hasAttribute('data-handle')
      ) {
        if (this.lastTextTap?.id === candidate.id && now - this.lastTextTap.time < 450) {
          this.lastTextTap = null;
          this.openText(candidate);
          event.preventDefault();
          return;
        }
        this.lastTextTap = { id: candidate.id, time: now };
      } else this.lastTextTap = null;
      this.board.setPointerCapture(event.pointerId);
      const handle = event.target.getAttribute('data-handle');
      const hit = this.itemAt(event);
      this.gesture = {
        pointerId: event.pointerId,
        before: this.history.items,
        start: point,
        mode: this.options.tool,
        changed: false,
      };
      if (this.options.tool === 'select') {
        if (handle && this.selected !== null) {
          this.gesture.mode = 'resize';
          this.gesture.handle = handle;
        } else this.selected = hit;
        this.gesture.original = this.history.items.find((item) => item.id === this.selected);
        if (this.gesture.original) {
          this.gesture.offset = M.offsetFor(this.gesture.original, this.center.ra);
          this.adoptStyle(this.gesture.original);
        }
      } else if (this.options.tool === 'eraser') {
        this.gesture.cuts = new Map();
        this.gesture.lastErase = point;
        this.erase(point);
      } else {
        this.gesture.draft = this.newItem(this.options.tool, [point, { ...point }]);
      }
      this.draw();
      event.preventDefault();
    }
    erase(point) {
      const gesture = this.gesture,
        previous = gesture.lastErase,
        unit = this.view.width / this.board.clientWidth,
        radius = Math.max(3, this.options.width / 2) * unit;
      const longitudeRadius = radius / Math.max(0.01, Math.cos((-point.y * Math.PI) / 180));
      // Only bbox candidates receive a cut; all other objects and cached SVG nodes are shared.
      this.history.items = this.history.items.map((item) => {
        if (item.type === 'text') return item;
        const shift = M.offsetFor(item, this.center.ra),
          a = { x: previous.x - shift, y: previous.y },
          b = { x: point.x - shift, y: point.y };
        if (!M.intersectsSweep(item, a, b, longitudeRadius, (item.width * unit) / 2)) return item;
        let cut = gesture.cuts.get(item.id);
        if (!cut) {
          cut = { radius, rx: longitudeRadius, ry: radius, points: [a, { ...a }] };
          gesture.cuts.set(item.id, cut);
          item = { ...item, erasures: [...(item.erasures || []), cut] };
        } else if (Math.hypot(cut.points.at(-1).x - a.x, cut.points.at(-1).y - a.y) > unit * 0.01) {
          // A new pass starts a subpath; never bridge the gap left outside the object.
          cut.points.push({ ...a, move: true });
        }
        M.appendPoint(cut.points, b, unit * 0.4);
        for (const surface of this.surfaces.values()) surface.nodeCache.delete(item);
        gesture.changed = true;
        return item;
      });
      gesture.lastErase = point;
    }
    movePointer(event) {
      const point = this.point(event);

      const gesture = this.gesture;
      if (!gesture || gesture.pointerId !== event.pointerId || !M.isSkyPoint(point)) return;
      if (gesture.mode === 'eraser') this.erase(point);
      else if (gesture.mode === 'select' && gesture.original) {
        const moved = M.move(
          gesture.original,
          point.x - gesture.start.x,
          point.y - gesture.start.y,
        );
        if (moved.points.every(M.isSkyPoint))
          this.history.items = gesture.before.map((item) => (item.id === moved.id ? moved : item));
        gesture.changed = true;
      } else if (gesture.mode === 'resize' && gesture.original) {
        const b = M.bounds(gesture.original),
          h = gesture.handle,
          px = point.x - gesture.offset;
        const minSize = (this.view.width / this.board.clientWidth) * 4;
        const x1 = h.includes('w') ? Math.min(px, b.x + b.width - minSize) : b.x;
        const x2 = h.includes('e') ? Math.max(px, b.x + minSize) : b.x + b.width;
        const y1 = h.includes('n') ? Math.min(point.y, b.y + b.height - minSize) : b.y;
        const y2 = h.includes('s') ? Math.max(point.y, b.y + minSize) : b.y + b.height;
        const resized = M.resize(gesture.original, {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
        });
        if (resized.points.every(M.isSkyPoint))
          this.history.items = gesture.before.map((item) =>
            item.id === resized.id ? resized : item,
          );
        gesture.changed = true;
      } else if (gesture.draft) {
        if (gesture.mode === 'pencil') {
          const last = gesture.draft.points.at(-1);
          if (
            Math.hypot(point.x - last.x, point.y - last.y) >
            (this.view.width / this.board.clientWidth) * 0.5
          )
            M.appendPoint(
              gesture.draft.points,
              point,
              (this.view.width / this.board.clientWidth) * 0.4,
            );
        } else gesture.draft.points[1] = point;
        M.invalidate(gesture.draft);
        for (const surface of this.surfaces.values()) surface.nodeCache.delete(gesture.draft);
      }
      this.draw();
    }
    finish() {
      const gesture = this.gesture;
      if (!gesture) return;
      this.gesture = null;
      if (gesture.draft) this.history.commit([...gesture.before, gesture.draft], gesture.before);
      else if (gesture.changed) this.history.commit(this.history.items, gesture.before);
      if (this.board.hasPointerCapture(gesture.pointerId))
        this.board.releasePointerCapture(gesture.pointerId);
      this.draw();
    }
    cancel() {
      if (this.pointerFrame) cancelAnimationFrame(this.pointerFrame);
      this.pointerFrame = 0;
      this.pendingPointer = null;
      if (!this.gesture) return;
      const gesture = this.gesture;
      this.gesture = null;
      this.history.items = gesture.before;
      if (this.board?.hasPointerCapture(gesture.pointerId))
        this.board.releasePointerCapture(gesture.pointerId);
      this.draw();
    }
    attachSurface(board, projection) {
      const surface = { board, projection, nodeCache: new WeakMap() },
        abort = new AbortController();
      this.surfaces.set(board, surface);
      this.activate(surface);
      const listen = (type, fn) => board.addEventListener(type, fn, { signal: abort.signal });
      listen('pointerdown', (event) => {
        this.activate(surface);
        this.down(event);
      });
      listen('pointermove', (event) => {
        if (this.gesture && this.board !== board) return;
        this.activate(surface);
        this.pendingPointer = event;
        if (!this.pointerFrame)
          this.pointerFrame = requestAnimationFrame(() => {
            this.pointerFrame = 0;
            const latest = this.pendingPointer;
            this.pendingPointer = null;
            if (latest && this.gesture) this.movePointer(latest);
          });
      });
      listen('pointerup', (event) => {
        if (this.gesture?.pointerId === event.pointerId) {
          this.flushPointer();
          this.movePointer(event);
          this.finish();
        }
      });
      listen('pointercancel', () => this.cancel());
      listen('lostpointercapture', () => {
        if (this.gesture) this.cancel();
      });
      listen('keydown', (event) => {
        this.activate(surface);
        this.key(event);
      });
      const unsubscribe = projection.subscribe(() => {
        this.cancel();
        surface.nodeCache = new WeakMap();
        this.scheduleDraw();
      });
      const observer = new ResizeObserver(() => {
        surface.nodeCache = new WeakMap();
        this.scheduleDraw();
      });
      observer.observe(board);
      this.draw();
      return () => {
        if (this.board === board) this.cancel();
        abort.abort();
        unsubscribe();
        observer.disconnect();
        this.surfaces.delete(board);
        const remaining = this.surfaces.values().next().value;
        if (remaining) this.activate(remaining);
        else {
          this.board = undefined;
          this.projection = undefined;
        }
      };
    }
    activate(surface) {
      this.board = surface.board;
      this.projection = surface.projection;
      this.nodeCache = surface.nodeCache;
      const view = surface.projection.getView(),
        [width, height] = surface.projection.getSize();
      this.center = { ra: view.longitude, dec: view.latitude };
      this.view = M.frame(this.center, width, height, view.fov);
    }
    scheduleDraw() {
      if (!this.drawFrame)
        this.drawFrame = requestAnimationFrame(() => {
          this.drawFrame = 0;
          this.draw();
        });
    }
    project(point) {
      const pixel = this.projection.worldToPixel(M.wrapRA(point.x), -point.y);
      return pixel && pixel.every(Number.isFinite) ? { x: pixel[0], y: pixel[1] } : null;
    }
    projectedPoints(item) {
      if (['pencil', 'line', 'image', 'emoji', 'text'].includes(item.type))
        return item.points.map((p) => this.project(p));
      const b = M.bounds(item),
        points = [];
      if (item.type === 'ellipse') {
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          points.push({
            x: b.x + b.width / 2 + (Math.cos(angle) * b.width) / 2,
            y: b.y + b.height / 2 + (Math.sin(angle) * b.height) / 2,
          });
        }
      } else {
        const corners = [
          { x: b.x, y: b.y },
          { x: b.x + b.width, y: b.y },
          { x: b.x + b.width, y: b.y + b.height },
          { x: b.x, y: b.y + b.height },
          { x: b.x, y: b.y },
        ];
        for (let side = 0; side < 4; side++)
          for (let i = 0; i < 8; i++)
            points.push({
              x: corners[side].x + ((corners[side + 1].x - corners[side].x) * i) / 8,
              y: corners[side].y + ((corners[side + 1].y - corners[side].y) * i) / 8,
            });
        points.push(corners[0]);
      }
      return points.map((p) => this.project(p));
    }
    pixelBounds(points) {
      const valid = points.filter(Boolean);
      if (!valid.length) return null;
      return M.bounds({ points: valid });
    }
    pathFor(points) {
      let path = '',
        previous = null;
      for (const point of points) {
        if (!point) {
          previous = null;
          continue;
        }
        path += `${previous && !point.move ? 'L' : 'M'}${point.x},${point.y} `;
        previous = point;
      }
      return path;
    }
    itemNode(item) {
      const cached = this.nodeCache.get(item);
      if (cached) return cached;
      const points = this.projectedPoints(item),
        b = this.pixelBounds(points),
        group = svg('g');
      if (!b) return group;
      const common = { 'data-item': item.id, opacity: item.opacity };
      let node;
      if (item.type === 'image')
        node = svg('image', {
          ...common,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          href: item.src,
          preserveAspectRatio: 'none',
        });
      else if (item.type === 'text') {
        const lines = item.text.split('\n'),
          size = b.height / (lines.length * 1.3);
        node = svg('text', {
          'data-item': item.id,
          fill: item.color,
          opacity: item.opacity,
          'font-family': 'Segoe UI, Segoe UI Symbol, sans-serif',
          'font-weight': 'bold',
          'font-size': size,
        });
        const context = this.textContext;
        context.font = 'bold 100px "Segoe UI",sans-serif';
        let widths = this.textMetrics.get(item.text);
        if (!widths) {
          widths = lines.map((line) => context.measureText(line).width);
          if (this.textMetrics.size >= 64)
            this.textMetrics.delete(this.textMetrics.keys().next().value);
          this.textMetrics.set(item.text, widths);
        }
        const max = Math.max(1, ...widths);
        lines.forEach((line, index) => {
          const span = svg('tspan', { x: b.x, y: b.y + size * (1 + index * 1.3) });
          span.textContent = line || ' ';
          if (widths[index] > 0) {
            span.setAttribute('textLength', (b.width * widths[index]) / max);
            span.setAttribute('lengthAdjust', 'spacingAndGlyphs');
          }
          node.append(span);
        });
      } else if (item.type === 'emoji') {
        node = svg('text', {
          ...common,
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': Math.max(1, Math.min(b.width, b.height) * 0.8),
        });
        node.textContent = item.text;
      } else {
        node = svg('path', {
          ...common,
          d: this.pathFor(points),
          fill: item.fill && ['rect', 'ellipse'].includes(item.type) ? item.color : 'none',
          stroke: item.color,
          'stroke-width': item.width,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        });
        if (!b.width && !b.height)
          node = svg('circle', {
            ...common,
            cx: b.x,
            cy: b.y,
            r: item.width / 2,
            fill: item.color,
          });
      }
      if (item.erasures?.length) {
        const id = `${this.instanceId}-${this.surfaceIndex}-mask-${item.id}`,
          pad = item.width + 2,
          defs = svg('defs');
        const mask = svg('mask', {
          id,
          maskUnits: 'userSpaceOnUse',
          x: b.x - pad,
          y: b.y - pad,
          width: b.width + 2 * pad,
          height: b.height + 2 * pad,
          'mask-type': 'luminance',
        });
        mask.append(
          svg('rect', {
            x: b.x - pad,
            y: b.y - pad,
            width: b.width + 2 * pad,
            height: b.height + 2 * pad,
            fill: 'white',
          }),
        );
        for (const cut of item.erasures) {
          const projected = cut.points.map((p) => {
              const value = this.project(p);
              return value ? { ...value, move: p.move } : null;
            }),
            first = cut.points.find((p) => this.project(p));
          if (!first) continue;
          const origin = this.project(first),
            px = this.project({ x: first.x + (cut.rx ?? cut.radius), y: first.y }),
            py = this.project({
              x: first.x,
              y: M.clamp(first.y + (cut.ry ?? cut.radius), -90, 90),
            });
          const rx = Math.max(
              0.5,
              px
                ? Math.hypot(px.x - origin.x, px.y - origin.y)
                : (cut.radius / this.view.width) * this.board.clientWidth,
            ),
            ry = Math.max(0.5, py ? Math.hypot(py.x - origin.x, py.y - origin.y) : rx);
          mask.append(
            svg('path', {
              d: this.pathFor(
                projected.map((p) => (p ? { ...p, x: p.x / rx, y: p.y / ry } : null)),
              ),
              transform: `scale(${rx} ${ry})`,
              fill: 'none',
              stroke: 'black',
              'stroke-width': 2,
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
            }),
          );
        }
        defs.append(mask);
        group.append(defs);
        node.setAttribute('mask', `url(#${id})`);
      }
      group.append(node);
      this.nodeCache.set(item, group);
      return group;
    }
    draw() {
      if (!this.surfaces.size) {
        this.updateControls();
        return;
      }
      const active = this.surfaces.get(this.board) || this.surfaces.values().next().value;
      let index = 0;
      for (const surface of this.surfaces.values()) {
        this.activate(surface);
        this.surfaceIndex = index++;
        const [width, height] = this.projection.getSize();
        this.board.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.board.style.pointerEvents = this.enabled && this.visible ? 'auto' : 'none';
        this.board.style.visibility = this.visible ? 'visible' : 'hidden';
        this.board.tabIndex = this.enabled && this.visible ? 0 : -1;
        const nodes = this.history.items.map((item) => this.itemNode(item));
        if (this.gesture?.draft) nodes.push(this.itemNode(this.gesture.draft));
        const selected = this.history.items.find((item) => item.id === this.selected);
        if (selected && this.enabled) {
          const b = this.pixelBounds(this.projectedPoints(selected));
          if (b) {
            const group = svg('g', { 'data-selection': 'true' }),
              x = b.x - 5,
              y = b.y - 5,
              w = b.width + 10,
              h = b.height + 10;
            group.append(
              svg('rect', {
                x,
                y,
                width: w,
                height: h,
                fill: 'none',
                stroke: '#66d8c4',
                'stroke-width': 1,
                'stroke-dasharray': '4 3',
                'pointer-events': 'none',
              }),
            );
            for (const [handle, hx, hy] of [
              ['nw', x, y],
              ['ne', x + w, y],
              ['sw', x, y + h],
              ['se', x + w, y + h],
            ]) {
              const worldHandle = handle.replace(/[we]/g, (letter) => (letter === 'w' ? 'e' : 'w'));
              const square = svg('rect', {
                x: hx - 5,
                y: hy - 5,
                width: 10,
                height: 10,
                fill: '#e9fff9',
                stroke: '#27736e',
                'data-handle': worldHandle,
              });
              square.style.cursor = `${handle}-resize`;
              group.append(square);
            }
            nodes.push(group);
          }
        }
        nodes.forEach((node, i) => {
          if (this.board.children[i] !== node)
            this.board.insertBefore(node, this.board.children[i] || null);
        });
        while (this.board.children.length > nodes.length) this.board.lastElementChild.remove();
        this.board.dataset.annotationCount = String(this.history.items.length);
      }
      this.activate(active);
      this.updateControls();
    }
    async importImage(file) {
      this.shadowRoot.getElementById('file').value = '';
      if (!file) return;
      if (!this.projection) {
        this.say('Espera a que cargue el visor.');
        return;
      }
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        this.say('Elige una imagen PNG o JPG de hasta 10 MB.');
        return;
      }
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = data;
        await image.decode();
        if (!this.projection) return;
        const w = this.view.width * 0.2,
          h = Math.min(this.view.width * 0.4, (w * image.naturalHeight) / image.naturalWidth);
        const item = this.newItem('image', [
          { x: this.center.ra - w / 2, y: M.clamp(-this.center.dec - h / 2, -90, 90 - h) },
          { x: this.center.ra + w / 2, y: M.clamp(-this.center.dec - h / 2, -90, 90 - h) + h },
        ]);
        item.src = data;
        this.change([...this.history.items, item]);
        this.setTool('select');
        this.selected = item.id;
        this.draw();
        this.say('Imagen añadida. Puedes moverla o escalarla.');
      } catch {
        this.say('No se pudo leer la imagen. Prueba otro PNG o JPG.');
      }
    }
    async exportImage(format) {
      if (!this.history.items.length || !this.board) return;
      this.cancel();
      const clone = this.board.cloneNode(true);
      clone.querySelector('[data-selection]')?.remove();
      if (format === 'png') clone.querySelector('[data-background]')?.remove();
      const width = Math.max(1, this.board.clientWidth),
        height = Math.max(1, this.board.clientHeight),
        ratio = Math.min(devicePixelRatio || 1, 2);
      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: 'image/svg+xml;charset=utf-8',
        }),
      );
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d');
        context.scale(ratio, ratio);
        if (format === 'jpeg') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
        }
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, `image/${format}`, 0.94),
        );
        if (!blob) throw new Error('Export failed');
        const downloadURL = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = downloadURL;
        link.download = `estar_RA${this.center.ra.toFixed(5)}_DEC${this.center.dec.toFixed(5)}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(downloadURL), 10000);
        this.say(`Exportado ${format === 'jpeg' ? 'JPG' : 'PNG'} del campo visible.`);
      } catch {
        this.say('No se pudo exportar la imagen.');
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }
  PaintWidget.nextInstance = 1;
  customElements.define('spherex-paint', PaintWidget);
})();

export function createPaintController() {
  return document.createElement('spherex-paint');
}
