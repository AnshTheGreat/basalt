import { EditorView, WidgetType } from '@codemirror/view';
import hljs from 'highlight.js';

function highlight(code: string, lang: string): string {
  try {
    return lang
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  }
}

export class CodeWidget extends WidgetType {
  constructor(
    readonly lang: string,
    readonly code: string,
    readonly from: number,
    readonly to: number,
  ) { super(); }

  eq(o: WidgetType) {
    return o instanceof CodeWidget && o.lang === this.lang && o.code === this.code &&
      o.from === this.from && o.to === this.to;
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.className = 'cm-code-block';
    container.addEventListener('mousedown', (e) => e.stopPropagation());
    container.addEventListener('click', (e) => e.stopPropagation());

    // Header: [toggle] [lang] [copy]
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

    // Body: editable <pre><code>
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

    // Debounced sync: while editing, push the new code into the document.
    // This ensures the state field always has the latest source, so when
    // the cursor leaves the line the widget rebuilds with the new content.
    let syncTimer: number | null = null;
    const sync = () => {
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        const newCode = codeEl.textContent || '';
        if (newCode !== this.code) {
          const safe = newCode.replace(/'/g, "\\'");
          const newText = `code'${this.lang}'_'${safe}'`;
          try {
            view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
          } catch { /* stale range — ignore */ }
        }
      }, 300);
    };

    codeEl.addEventListener('input', sync);

    // Restore highlight when the cell loses focus
    codeEl.addEventListener('blur', () => {
      if (syncTimer !== null) { window.clearTimeout(syncTimer); syncTimer = null; }
      const newCode = codeEl.textContent || '';
      if (newCode !== this.code) {
        const safe = newCode.replace(/'/g, "\\'");
        const newText = `code'${this.lang}'_'${safe}'`;
        try {
          view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
        } catch { /* stale */ }
      } else {
        // No change — just re-highlight the raw text
        codeEl.innerHTML = highlight(this.code, this.lang);
      }
    });

    container.appendChild(header);
    container.appendChild(pre);
    return container;
  }

  ignoreEvent() { return true; }
}
