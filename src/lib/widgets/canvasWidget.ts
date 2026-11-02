import { WidgetType } from '@codemirror/view';

/**
 * In-memory bitmap cache keyed by vault path. Used to restore a canvas
 * instantly when CodeMirror destroys + recreates its widget during scroll,
 * before the file-on-disk read completes.
 */
const canvasCache = new Map<string, HTMLCanvasElement>();

interface CanvasEntry {
  canvas: HTMLCanvasElement;
  path: string;
  dirty: boolean;
}

/**
 * Every mounted canvas registers here. A single interval walks the
 * registry every second, saving dirty canvases and cleaning up entries
 * whose DOM has been detached (widget destroyed by scroll).
 */
const canvasRegistry = new Map<HTMLCanvasElement, CanvasEntry>();

let intervalId: number | null = null;

function ensureInterval() {
  if (intervalId !== null) return;
  intervalId = window.setInterval(() => {
    for (const [canvas, entry] of Array.from(canvasRegistry.entries())) {
      // Widget was removed from the DOM — save whatever's on it, then
      // drop it from the registry so we don't leak entries.
      if (!canvas.isConnected) {
        void saveCanvas(canvas, entry.path);
        canvasRegistry.delete(canvas);
        continue;
      }
      // Live canvas with pending changes — flush to disk.
      if (entry.dirty) {
        void saveCanvas(canvas, entry.path);
      }
    }
  }, 1000);
}

async function saveCanvas(canvas: HTMLCanvasElement, path: string) {
  const entry = canvasRegistry.get(canvas);
  if (entry) entry.dirty = false;

  try {
    // Snapshot to the in-memory cache first, so a widget recreation
    // mid-write still shows the current drawing.
    const cached = document.createElement('canvas');
    cached.width = 400;
    cached.height = 400;
    cached.getContext('2d')!.drawImage(canvas, 0, 0);
    canvasCache.set(path, cached);

    // Then persist to disk.
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const buf = await blob.arrayBuffer();
    await window.vaultAPI.writeBinary(path, buf);
  } catch (err) {
    console.error('Canvas save failed:', err);
    // Re-flag for next tick so a transient failure retries.
    if (entry && !entry.dirty) entry.dirty = true;
  }
}

export class CanvasWidget extends WidgetType {
  constructor(readonly path: string) { super(); }

  eq(o: WidgetType) {
    return o instanceof CanvasWidget && o.path === this.path;
  }

  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-canvas-box';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      box.addEventListener(ev, (e) => e.stopPropagation());
    }

    // ---- Row 1: color picker + darkness slider + preview swatch ----
    const toolbar1 = document.createElement('div');
    toolbar1.className = 'cm-canvas-toolbar';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      toolbar1.addEventListener(ev, (e) => e.stopPropagation());
    }

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'cm-canvas-color';
    colorPicker.value = '#000000';
    colorPicker.title = 'Base color';

    const darkness = document.createElement('input');
    darkness.type = 'range';
    darkness.className = 'cm-canvas-darkness';
    darkness.min = '0';
    darkness.max = '100';
    darkness.value = '50';
    darkness.title = 'Darkness — 0 = white (eraser), 50 = base color, 100 = black';

    const preview = document.createElement('span');
    preview.className = 'cm-canvas-preview';
    preview.title = 'Current pencil color';

    toolbar1.appendChild(colorPicker);
    toolbar1.appendChild(darkness);
    toolbar1.appendChild(preview);

    // ---- Row 2: size slider ----
    const toolbar2 = document.createElement('div');
    toolbar2.className = 'cm-canvas-toolbar';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      toolbar2.addEventListener(ev, (e) => e.stopPropagation());
    }

    const size = document.createElement('input');
    size.type = 'range';
    size.className = 'cm-canvas-size';
    size.min = '1';
    size.max = '50';
    size.value = '3';
    size.title = 'Pencil size';

    const sizeLabel = document.createElement('span');
    sizeLabel.className = 'cm-canvas-size-label';
    sizeLabel.textContent = '3px';

    toolbar2.appendChild(size);
    toolbar2.appendChild(sizeLabel);

    box.appendChild(toolbar1);
    box.appendChild(toolbar2);

    // ---- Canvas ----
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    canvas.style.width = '400px';
    canvas.style.height = '400px';
    box.appendChild(canvas);

    // ---- Resize handle ----
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'cm-canvas-resize-handle';
    box.appendChild(resizeHandle);

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);

    // ---- Load: cache first (instant), then file ----
    const cachedEntry = canvasCache.get(this.path);
    if (cachedEntry) {
      ctx.drawImage(cachedEntry, 0, 0, 400, 400);
    } else {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, 400, 400);
      img.onerror = () => {};
      // `?t=` cache-buster so Chromium never serves a stale blank.
      img.src = `vault:///${this.path}?t=${Date.now()}`;
    }

    // ---- Color state ----
    let pencilColor = '#000000';
    let pencilSize = 3;

    const computeColor = (): string => {
      const d = parseInt(darkness.value, 10) || 50;
      const hex = colorPicker.value || '#000000';
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;

      let nr: number, ng: number, nb: number;
      if (d === 0) {
        nr = 255; ng = 255; nb = 255;
      } else if (d === 100) {
        nr = 0; ng = 0; nb = 0;
      } else if (d < 50) {
        const t = d / 50;
        nr = Math.round(255 + (r - 255) * t);
        ng = Math.round(255 + (g - 255) * t);
        nb = Math.round(255 + (b - 255) * t);
      } else {
        const t = (d - 50) / 50;
        nr = Math.round(r * (1 - t));
        ng = Math.round(g * (1 - t));
        nb = Math.round(b * (1 - t));
      }
      return `rgb(${nr}, ${ng}, ${nb})`;
    };

    const refreshState = () => {
      pencilColor = computeColor();
      pencilSize = parseInt(size.value, 10) || 3;
      preview.style.background = pencilColor;
      sizeLabel.textContent = `${pencilSize}px`;
    };

    colorPicker.addEventListener('input', refreshState);
    colorPicker.addEventListener('change', refreshState);
    darkness.addEventListener('input', refreshState);
    darkness.addEventListener('change', refreshState);
    size.addEventListener('input', refreshState);
    size.addEventListener('change', refreshState);
    refreshState();

    // ---- Register in the auto-save registry ----
    const entry: CanvasEntry = { canvas, path: this.path, dirty: false };
    canvasRegistry.set(canvas, entry);
    ensureInterval();

    // ---- Ctrl+S → immediate save ----
    canvas.addEventListener('basalt:save', () => {
      void saveCanvas(canvas, this.path);
    });

    // ---- Drawing ----
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (400 / r.width),
        y: (e.clientY - r.top) * (400 / r.height),
      };
    };

    canvas.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      refreshState();
      drawing = true;
      const p = getPos(e);
      lastX = p.x;
      lastY = p.y;
    };

    canvas.onmousemove = (e) => {
      if (!drawing) return;
      const p = getPos(e);
      ctx.strokeStyle = pencilColor;
      ctx.lineWidth = pencilSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    };

    const endStroke = () => {
      if (!drawing) return;
      drawing = false;
      entry.dirty = true;
      // Refresh cache immediately so a widget recreate before the
      // next interval tick still shows the latest drawing.
      const cached = document.createElement('canvas');
      cached.width = 400;
      cached.height = 400;
      cached.getContext('2d')!.drawImage(canvas, 0, 0);
      canvasCache.set(this.path, cached);
      // Fire-and-forget disk save.
      void saveCanvas(canvas, this.path);
    };

    canvas.onmouseup = endStroke;
    canvas.onmouseleave = endStroke;

    // ---- Resize — keep square so nothing stretches ----
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 400;
    let startH = 400;

    const onMove = (ev: MouseEvent) => {
      if (!resizing) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Use the larger delta so the canvas always stays square, which
      // matches "expand, don't stretch" — same as photos maintaining
      // their aspect ratio.
      const sizePx = Math.max(100, Math.max(startW + dx, startH + dy));
      canvas.style.width = `${sizePx}px`;
      canvas.style.height = `${sizePx}px`;
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = canvas.offsetWidth;
      startH = canvas.offsetHeight;
      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    });

    return box;
  }

  ignoreEvent() { return true; }
}
