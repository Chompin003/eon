import type { ExportLayers, SkyProjectionWindow } from '../shared';

export function abortExport(signal: AbortSignal) {
  signal.throwIfAborted();
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error('El visor tardó demasiado en crear la imagen. Vuelve a intentarlo.'));
    }, 20000);
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

/** Wait for React, projection subscribers, and Canvas to present the requested date. */
export async function waitForExportFrame(root: HTMLElement, id: string, signal: AbortSignal) {
  const start = performance.now();
  for (;;) {
    abortExport(signal);
    const canvases = [...root.querySelectorAll<HTMLCanvasElement>('.region-canvas')];
    if (
      canvases.length &&
      canvases.every((c) => c.dataset.ready === 'true' && c.dataset.frameId === id)
    ) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      abortExport(signal);
      if (canvases.every((c) => c.dataset.ready === 'true' && c.dataset.frameId === id)) return;
    }
    if (performance.now() - start > 12000)
      throw Error('No se pudo presentar esta fecha para exportarla.');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const svgProperties = [
  'color',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'paint-order',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'opacity',
  'visibility',
  'display',
  'vector-effect',
  'mask',
  'clip-path',
];

async function paintBlob(
  ctx: CanvasRenderingContext2D,
  blob: Blob,
  rect: DOMRect,
  signal: AbortSignal,
) {
  abortExport(signal);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await abortable(image.decode(), signal);
    abortExport(signal);
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function paintSvg(
  ctx: CanvasRenderingContext2D,
  original: SVGSVGElement,
  signal: AbortSignal,
) {
  const clone = original.cloneNode(true) as SVGSVGElement;
  const originals = [original, ...original.querySelectorAll<SVGElement>('*')];
  const copies = [clone, ...clone.querySelectorAll<SVGElement>('*')];
  originals.forEach((element, i) => {
    const computed = getComputedStyle(element);
    for (const property of svgProperties) {
      // Computed masks may contain the document's absolute URL. In the image they must stay local.
      const value = computed
        .getPropertyValue(property)
        .replace(/url\(["']?[^)"']*#([^)'"\s]+)["']?\)/g, 'url(#$1)');
      copies[i].style.setProperty(property, value);
    }
    if (original.classList.contains('study-annotations')) copies[i].style.visibility = 'visible';
  });
  clone.querySelectorAll('[data-selection]').forEach((element) => element.remove());
  const rect = original.getBoundingClientRect();
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(rect.width));
  clone.setAttribute('height', String(rect.height));
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  // Position belongs to the compositor, not to the standalone SVG image.
  clone.style.position = 'static';
  const xml = new XMLSerializer().serializeToString(clone);
  await paintBlob(ctx, new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), rect, signal);
}

/** Compose only visual layers. Controls and notices never enter the exported bitmap. */
export async function captureSky(
  root: HTMLElement,
  layers: ExportLayers,
  signal: AbortSignal,
  options: { maxSide?: number; opaque?: boolean; date?: string } = {},
): Promise<HTMLCanvasElement> {
  abortExport(signal);
  if (!layers.space && !layers.annotations && !layers.markers)
    throw Error('Elige al menos una capa.');
  const panes = [...root.querySelectorAll<HTMLElement>('.sky-pane')].filter(
    (pane) => !pane.parentElement?.closest('.sky-pane'),
  );
  const surfaces = panes
    .map((pane) => pane.querySelector<HTMLElement>('.region-stage, .sky-canvas'))
    .filter((surface): surface is HTMLElement => Boolean(surface));
  if (!surfaces.length) throw Error('Abre una imagen del cielo antes de exportar.');
  const rects = surfaces.map((surface) => surface.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left)),
    top = Math.min(...rects.map((r) => r.top));
  const width = Math.max(...rects.map((r) => r.right)) - left;
  const height = Math.max(...rects.map((r) => r.bottom)) - top;
  if (width < 2 || height < 2) throw Error('El visor no está visible.');
  const scale = Math.min(
    Math.min(devicePixelRatio || 1, 2),
    (options.maxSide ?? 4096) / Math.max(width, height),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d')!;
  if (options.opaque || layers.space) {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  ctx.imageSmoothingEnabled = false;

  const surface = async (host: HTMLElement, opacity = 1) => {
    abortExport(signal);
    const rect = host.getBoundingClientRect();
    ctx.save();
    try {
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();
      ctx.globalAlpha *= opacity;
      if (layers.space) {
        const region = host.querySelector<HTMLCanvasElement>(':scope > .region-canvas');
        if (region) {
          if (region.dataset.ready !== 'true')
            throw Error('Espera a que termine de prepararse esta imagen.');
          ctx.drawImage(region, rect.x, rect.y, rect.width, rect.height);
        } else {
          if (host.dataset.connected !== 'true')
            throw Error('El mosaico todavía no está listo para exportar.');
          const iframe = host.querySelector<HTMLIFrameElement>(':scope > iframe');
          const capture = (iframe?.contentWindow as SkyProjectionWindow | null)?.spherexCapture;
          if (!capture) throw Error('Esta imagen no permite todavía una captura.');
          const blob = await abortable(capture(), signal);
          await paintBlob(ctx, blob, rect, signal);
        }
        const overlay = host.querySelector<HTMLElement>(':scope > .registered-archive');
        const archive = overlay?.querySelector<HTMLElement>('.sky-canvas');
        if (overlay && archive) await surface(archive, Number(getComputedStyle(overlay).opacity));
      }
      for (const svg of host.querySelectorAll<SVGSVGElement>(':scope > svg')) {
        if (
          (layers.space && svg.classList.contains('angular-scale')) ||
          (layers.annotations && svg.classList.contains('study-annotations')) ||
          (layers.markers && svg.classList.contains('study-markers'))
        ) {
          await paintSvg(ctx, svg, signal);
        }
      }
    } finally {
      ctx.restore();
    }
  };
  try {
    for (const host of surfaces) await surface(host);
    if (options.date) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const size = Math.max(12, Math.round(canvas.width / 65));
      ctx.font = `${size}px sans-serif`;
      const label = 'SPHEREx · ' + options.date.slice(0, 19).replace('T', ' ') + ' UTC';
      ctx.fillStyle = 'rgba(0,0,0,.8)';
      ctx.fillRect(8, 8, ctx.measureText(label).width + 16, size + 12);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 16, size + 12);
    }
    abortExport(signal);
    return canvas;
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}

export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error('No se pudo crear el PNG.'))),
      'image/png',
    ),
  );
}
