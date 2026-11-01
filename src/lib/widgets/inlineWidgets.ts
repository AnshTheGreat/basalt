import { EditorView, WidgetType } from '@codemirror/view';
import katex from 'katex';

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
