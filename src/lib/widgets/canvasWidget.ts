import { WidgetType } from '@codemirror/view';

export class CanvasWidget extends WidgetType {
  constructor(readonly path: string) { super(); }
  eq(o: WidgetType) { return o instanceof CanvasWidget && o.path === this.path; }

  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-canvas-box';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      box.addEventListener(ev, (e) => e.stopPropagation());
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'cm-canvas-toolbar';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      toolbar.addEventListener(ev, (e) => e.stopPropagation());
    }

    let tool: 'pencil' | 'eraser' = 'pencil';

    const pencilBtn = document.createElement('button');
    pencilBtn.textContent = '✏';
    pencilBtn.title = 'Pencil';
    pencilBtn.className = 'active';

    const eraserBtn = document.createElement('button');
    eraserBtn.textContent = '⌫';
    eraserBtn.title = 'Eraser';

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.title = 'Clear';

    pencilBtn.onclick = (e) => {
      e.stopPropagation();
      tool = 'pencil';
      pencilBtn.classList.add('active');
      eraserBtn.classList.remove('active');
    };
    eraserBtn.onclick = (e) => {
      e.stopPropagation();
      tool = 'eraser';
      eraserBtn.classList.add('active');
      pencilBtn.classList.remove('active');
    };

    toolbar.appendChild(pencilBtn);
    toolbar.appendChild(eraserBtn);
    toolbar.appendChild(clearBtn);
    box.appendChild(toolbar);

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    box.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);

    clearBtn.onclick = (e) => {
      e.stopPropagation();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);
      save();
    };

    const img = new Image();
    img.src = `vault:///${this.path}`;
    img.onload = () => ctx.drawImage(img, 0, 0, 400, 400);
    img.onerror = () => {};

    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    let saveTimer: number | null = null;

    const save = async () => {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const buf = await blob.arrayBuffer();
      try { await window.vaultAPI.writeBinary(this.path, buf); }
      catch (err) { console.error('Canvas save failed:', err); }
    };

    const scheduleSave = () => {
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(save, 200);
    };

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
      drawing = true;
      const p = getPos(e);
      lastX = p.x;
      lastY = p.y;
    };
    canvas.onmousemove = (e) => {
      if (!drawing) return;
      const p = getPos(e);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#000000';
      ctx.lineWidth = tool === 'eraser' ? 40 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    };
    canvas.onmouseup = () => {
      if (drawing) { drawing = false; scheduleSave(); }
    };
    canvas.onmouseleave = () => {
      if (drawing) { drawing = false; scheduleSave(); }
    };

    return box;
  }
  ignoreEvent() { return true; }
}
