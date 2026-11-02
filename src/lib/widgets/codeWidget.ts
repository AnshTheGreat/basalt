import { EditorView, WidgetType } from '@codemirror/view';
import hljs from 'highlight.js';

function highlight(code: string, lang: string): string {
  try {
    return lang ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  }
}

/** Insert plain text (with newlines) at the current cursor in a contenteditable. */
function insertTextAtCursor(text: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const tn = document.createTextNode(text);
  range.insertNode(tn);
  range.setStartAfter(tn);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

export class CodeWidget extends WidgetType {
  constructor(readonly lang: string, readonly code: string, readonly from: number, readonly to: number) {
    super();
  }

  eq(o: WidgetType) {
    return o instanceof CodeWidget && o.lang === this.lang && o.code === this.code &&
      o.from === this.from && o.to === this.to;
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.className = 'cm-code-block';
    container.addEventListener('mousedown', (e) => e.stopPropagation());
    container.addEventListener('click', (e) => e.stopPropagation());

    const header = document.createElement('div');
    header.className = 'cm-code-header';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cm-code-toggle';
    toggleBtn.textContent = '−';
    let collapsed = false;

    const langLabel = document.createElement('span');
    langLabel.className = 'cm-code-lang';
    langLabel.textContent = this.lang || 'code';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-code-copy';
    copyBtn.textContent = 'Copy';

    header.appendChild(toggleBtn);
    header.appendChild(langLabel);
    header.appendChild(copyBtn);

    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.innerHTML = highlight(this.code, this.lang);
    codeEl.contentEditable = 'true';
    codeEl.spellcheck = false;
    pre.appendChild(codeEl);

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      collapsed = !collapsed;
      pre.style.display = collapsed ? 'none' : 'block';
      toggleBtn.textContent = collapsed ? '+' : '−';
    });

    copyBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    // Enter inserts a literal \n text node (never a <div>/<br>), so
    // textContent always returns the newlines the user typed.
    codeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        insertTextAtCursor('\n');
      }
    });

    // Paste inserts plain text with \n intact.
    codeEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text) return;
      insertTextAtCursor(text);
    });

    // Sync only on blur or when a save is triggered, so editing never
    // causes a widget rebuild mid-edit (which would steal the caret).
    const sync = () => {
      const newCode = codeEl.textContent || '';
      if (newCode === this.code) return;
      const safe = newCode.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const newText = `code"${this.lang}"_"${safe}"`;
      try {
        view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
      } catch { /* stale range */ }
    };

    codeEl.addEventListener('blur', () => {
      sync();
      if (codeEl.textContent === this.code) {
        codeEl.innerHTML = highlight(this.code, this.lang);
      }
    });

    container.addEventListener('basalt:save', () => { sync(); });

    container.appendChild(header);
    container.appendChild(pre);
    return container;
  }

  ignoreEvent() { return true; }
}
