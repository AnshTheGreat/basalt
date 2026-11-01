import { EditorView, WidgetType } from '@codemirror/view';
import katex from 'katex';
import hljs from 'highlight.js';
import { dragState } from './dragState';

export class LatexWidget extends WidgetType {
  constructor(readonly tex: string) { super(); }
  eq(o: WidgetType) { return o instanceof LatexWidget && o.tex === this.tex; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-latex';
    try { s.innerHTML = katex.renderToString(this.tex, { throwOnError: false }); }
    catch { s.textContent = `$${this.tex}$`; }
    return s;
  }
  ignoreEvent() { return true; }
}

export class MathPreviewWidget extends WidgetType {
  constructor(readonly exprs: string[]) { super(); }
  eq(o: WidgetType) {
    return o instanceof MathPreviewWidget &&
      o.exprs.length === this.exprs.length &&
      o.exprs.every((e, i) => e === this.exprs[i]);
  }
  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-math-preview';
    for (const expr of this.exprs) {
      const span = document.createElement('span');
      span.className = 'cm-math-preview-item';
      try { span.innerHTML = katex.renderToString(expr, { throwOnError: false }); }
      catch { span.textContent = expr; }
      box.appendChild(span);
    }
    return box;
  }
  ignoreEvent() { return true; }
}

export class DividerWidget extends WidgetType {
  toDOM() { const hr = document.createElement('hr'); hr.className = 'cm-divider'; return hr; }
  ignoreEvent() { return true; }
}

export class BulletWidget extends WidgetType {
  constructor(readonly level: number) { super(); }
  eq(o: WidgetType) { return o instanceof BulletWidget && o.level === this.level; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-bullet-marker';
    const lvl = Math.min(Math.max(this.level, 1), 10);
    s.style.display = 'inline-block';
    s.style.paddingLeft = `${(lvl - 1) * 1.2}em`;
    s.textContent = '•\u00a0';
    return s;
  }
  ignoreEvent() { return true; }
}

export class PinWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(o: WidgetType) { return o instanceof PinWidget && o.text === this.text; }
  toDOM() {
    const s = document.createElement('span');
    s.className = 'cm-pin';
    s.textContent = '📌';
    s.title = this.text;
    return s;
  }
  ignoreEvent() { return true; }
}

export class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number, readonly to: number) { super(); }
  eq(o: WidgetType) {
    return o instanceof CheckboxWidget && o.checked === this.checked && o.from === this.from && o.to === this.to;
  }
  toDOM(view: EditorView) {
    const i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = this.checked;
    i.className = 'cm-task-checkbox';
    i.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const cur = view.state.sliceDoc(this.from, this.to);
      let next: string | null = null;
      if (cur === '[x]' || cur === '[X]') next = '[]';
      else if (cur === '[]' || cur === '[ ]') next = '[x]';
      if (!next) return;
      view.dispatch({ changes: { from: this.from, to: this.to, insert: next } });
    });
    return i;
  }
  ignoreEvent() { return true; }
}

export class CodeWidget extends WidgetType {
  constructor(readonly lang: string, readonly code: string) { super(); }
  eq(o: WidgetType) { return o instanceof CodeWidget && o.lang === this.lang && o.code === this.code; }
  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-code-block';

    const header = document.createElement('div');
    header.className = 'cm-code-header';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      header.addEventListener(ev, (e) => e.stopPropagation());
    }

    const title = document.createElement('span');
    title.className = 'cm-code-lang';
    title.textContent = this.lang || 'code';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-code-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cm-code-toggle';
    toggleBtn.textContent = '−';
    let collapsed = false;

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    try {
      code.innerHTML = this.lang
        ? hljs.highlight(this.code, { language: this.lang }).value
        : hljs.highlightAuto(this.code).value;
    } catch { code.textContent = this.code; }
    pre.appendChild(code);

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      collapsed = !collapsed;
      pre.style.display = collapsed ? 'none' : 'block';
      toggleBtn.textContent = collapsed ? '+' : '−';
    });

    header.appendChild(title);
    header.appendChild(copyBtn);
    header.appendChild(toggleBtn);
    container.appendChild(header);
    container.appendChild(pre);
    return container;
  }
  ignoreEvent() { return false; }
}

export class LinkWidget extends WidgetType {
  constructor(readonly alias: string, readonly url: string) { super(); }
  eq(o: WidgetType) { return o instanceof LinkWidget && o.alias === this.alias && o.url === this.url; }
  toDOM() {
    const a = document.createElement('a');
    a.className = 'cm-link';
    a.textContent = this.alias;
    a.href = this.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }
  ignoreEvent() { return true; }
}

export class CommentWidget extends WidgetType {
  toDOM() { const s = document.createElement('span'); s.className = 'cm-comment'; s.textContent = '…'; return s; }
  ignoreEvent() { return true; }
}

export type EmbedKind = 'image' | 'audio' | 'video' | 'other';

export function embedKind(path: string): EmbedKind {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) return 'video';
  return 'other';
}

export class EmbedWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly path: string,
    readonly kind: EmbedKind,
    readonly from: number,
    readonly to: number,
  ) { super(); }

  eq(o: WidgetType) {
    return o instanceof EmbedWidget && o.path === this.path && o.kind === this.kind &&
      o.from === this.from && o.to === this.to;
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-embed';
    wrapper.draggable = true;

    wrapper.addEventListener('dragstart', (e) => {
      dragState.current = { from: this.from, to: this.to, text: view.state.sliceDoc(this.from, this.to) };
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });

    const src = `vault:///${this.path}`;

    if (this.kind === 'image') {
      const box = document.createElement('span');
      box.className = 'cm-embed-img-box';
      const img = document.createElement('img');
      img.src = src;
      img.alt = this.name;
      box.appendChild(img);
      wrapper.appendChild(box);
    } else if (this.kind === 'audio') {
      const box = document.createElement('span');
      box.className = 'cm-embed-media-box';
      const label = document.createElement('span');
      label.className = 'cm-embed-label';
      label.textContent = this.name;
      const audio = document.createElement('audio');
      audio.src = src;
      audio.controls = true;
      box.appendChild(label);
      box.appendChild(audio);
      wrapper.appendChild(box);
    } else if (this.kind === 'video') {
      const box = document.createElement('span');
      box.className = 'cm-embed-media-box';
      const label = document.createElement('span');
      label.className = 'cm-embed-label';
      label.textContent = this.name;
      const video = document.createElement('video');
      video.src = src;
      video.controls = true;
      box.appendChild(label);
      box.appendChild(video);
      wrapper.appendChild(box);
    } else {
      const a = document.createElement('a');
      a.className = 'cm-link';
      a.href = src;
      a.textContent = this.name;
      wrapper.appendChild(a);
    }
    return wrapper;
  }
  ignoreEvent() { return true; }
}

export class TableWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly rows: string[][],
  ) { super(); }
  eq(o: WidgetType) {
    return o instanceof TableWidget && o.from === this.from && o.to === this.to &&
      JSON.stringify(o.rows) === JSON.stringify(this.rows);
  }
  toDOM(view: EditorView) {
    const wrap = document.createElement('div');
    wrap.className = 'cm-table-wrap';

    const table = document.createElement('table');
    table.className = 'cm-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    for (const cell of this.rows[0]) {
      const th = document.createElement('th');
      th.textContent = cell;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

    for (let i = 1; i < this.rows.length; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < this.rows[i].length; j++) {
        const td = document.createElement('td');
        td.textContent = this.rows[i][j] || '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);

    const toolbar = document.createElement('div');
    toolbar.className = 'cm-table-toolbar';
    for (const ev of ['mousedown', 'mouseup', 'click']) {
      toolbar.addEventListener(ev, (e) => e.stopPropagation());
    }

    const addRowBtn = document.createElement('button');
    addRowBtn.textContent = '+ Row';
    addRowBtn.onclick = (e) => {
      e.preventDefault();
      const cols = this.rows[0].length;
      const newRow = '| ' + Array(cols).fill('   ').join(' | ') + ' |';
      view.dispatch({ changes: { from: this.to, to: this.to, insert: '\n' + newRow } });
    };

    const addColBtn = document.createElement('button');
    addColBtn.textContent = '+ Col';
    addColBtn.onclick = (e) => {
      e.preventDefault();
      const lines = view.state.sliceDoc(this.from, this.to).split('\n');
      const newLines = lines.map((line, i) => {
        if (i === 1) return line + '----|';
        return line + '     |';
      });
      view.dispatch({ changes: { from: this.from, to: this.to, insert: newLines.join('\n') } });
    };

    toolbar.appendChild(addRowBtn);
    toolbar.appendChild(addColBtn);
    wrap.appendChild(toolbar);

    wrap.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      view.dispatch({ selection: { anchor: this.from + 1 }, scrollIntoView: true });
      view.focus();
    });

    return wrap;
  }
  ignoreEvent() { return false; }
}

export class CanvasWidget extends WidgetType {
  constructor(readonly path: string) { super(); }
  eq(o: WidgetType) { return o instanceof CanvasWidget && o.path === this.path; }
  toDOM() {
    const box = document.createElement('div');
    box.className = 'cm-canvas-box';

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    box.appendChild(canvas);

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);

    const toolbar = document.createElement('div');
    toolbar.className = 'cm-canvas-toolbar';
    let tool: 'pencil' | 'eraser' = 'pencil';

    const pencilBtn = document.createElement('button');
    pencilBtn.textContent = '✏';
    pencilBtn.className = 'active';
    pencilBtn.onclick = (e) => {
      e.stopPropagation();
      tool = 'pencil';
      pencilBtn.classList.add('active');
      eraserBtn.classList.remove('active');
    };

    const eraserBtn = document.createElement('button');
    eraserBtn.textContent = '⌫';
    eraserBtn.onclick = (e) => {
      e.stopPropagation();
      tool = 'eraser';
      eraserBtn.classList.add('active');
      pencilBtn.classList.remove('active');
    };

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);
      save();
    };

    toolbar.appendChild(pencilBtn);
    toolbar.appendChild(eraserBtn);
    toolbar.appendChild(clearBtn);
    box.appendChild(toolbar);

    const img = new Image();
    img.src = `vault:///${this.path}`;
    img.onload = () => ctx.drawImage(img, 0, 0, 400, 400);
    img.onerror = () => {};

    let drawing = false;
    let lastX = 0, lastY = 0;

    const getPos = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (400 / r.width),
        y: (e.clientY - r.top) * (400 / r.height),
      };
    };

    canvas.onmousedown = (e) => {
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
    };
    canvas.onmousemove = (e) => {
      if (!drawing) return;
      const p = getPos(e);
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : '#000000';
      ctx.lineWidth = tool === 'eraser' ? 20 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
    };
    canvas.onmouseup = () => { if (drawing) { drawing = false; save(); } };
    canvas.onmouseleave = () => { if (drawing) { drawing = false; save(); } };

    const save = async () => {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const buf = await blob.arrayBuffer();
      await window.vaultAPI.writeBinary(this.path, buf);
    };

    return box;
  }
  ignoreEvent() { return false; }
}
