import { EditorView, WidgetType } from '@codemirror/view';

function serialize(rows: string[][]): string {
  if (rows.length === 0) return '';
  const header = '| ' + rows[0].join(' | ') + ' |';
  const sep = '| ' + rows[0].map(() => '---').join(' | ') + ' |';
  const body = rows.slice(1).map((r) => '| ' + r.join(' | ') + ' |');
  return [header, sep, ...body].join('\n');
}

export class TableWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly rows: string[][],
  ) { super(); }

  eq(o: WidgetType) {
    return o instanceof TableWidget &&
      o.from === this.from &&
      o.to === this.to &&
      JSON.stringify(o.rows) === JSON.stringify(this.rows);
  }

  toDOM(view: EditorView) {
    let cellWidth = 140;
    let cellHeight = 0;

    const wrap = document.createElement('div');
    wrap.className = 'cm-table-widget';

    for (const ev of ['mousedown', 'mouseup', 'click', 'dblclick'] as const) {
      wrap.addEventListener(ev, (e) => e.stopPropagation());
    }
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });

    const inner = document.createElement('div');
    inner.className = 'cm-table-inner';
    wrap.appendChild(inner);

    const table = document.createElement('table');
    table.className = 'cm-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const cell of this.rows[0] || []) {
      const th = document.createElement('th');
      th.contentEditable = 'true';
      th.spellcheck = false;
      th.textContent = cell;
      th.style.width = `${cellWidth}px`;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = 1; i < this.rows.length; i++) {
      const tr = document.createElement('tr');
      for (const cell of this.rows[i]) {
        const td = document.createElement('td');
        td.contentEditable = 'true';
        td.spellcheck = false;
        td.textContent = cell;
        td.style.width = `${cellWidth}px`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    inner.appendChild(table);

    const applyCurrentSize = () => {
      for (const cell of Array.from(table.querySelectorAll('th, td'))) {
        const el = cell as HTMLElement;
        el.style.width = `${cellWidth}px`;
        if (cellHeight > 0) el.style.height = `${cellHeight}px`;
      }
      for (const tr of Array.from(table.querySelectorAll('tr'))) {
        const el = tr as HTMLElement;
        if (cellHeight > 0) el.style.height = `${cellHeight}px`;
        else el.style.height = '';
      }
    };

    const handle = document.createElement('div');
    handle.className = 'cm-table-resize-handle';
    inner.appendChild(handle);

    const readDOM = (): string[][] => {
      const out: string[][] = [];
      for (const tr of Array.from(table.querySelectorAll('tr'))) {
        const cells = tr.querySelectorAll('th, td');
        out.push(Array.from(cells).map((c) => (c.textContent || '').trim()));
      }
      return out;
    };

    const sync = () => {
      const newRows = readDOM();
      const newText = serialize(newRows);
      const oldText = view.state.sliceDoc(this.from, this.to);
      if (newText === oldText) return;
      try {
        view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
      } catch { /* stale */ }
    };

    wrap.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!wrap.isConnected) return;
        if (wrap.contains(document.activeElement)) return;
        sync();
      }, 0);
    });

    const colBar = document.createElement('div');
    colBar.className = 'cm-table-col-bar';

    const addCol = document.createElement('button');
    addCol.className = 'cm-table-sq-btn';
    addCol.textContent = '+';
    addCol.title = 'Add column';
    addCol.addEventListener('mousedown', (e) => e.preventDefault());
    addCol.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      for (const tr of Array.from(table.querySelectorAll('tr'))) {
        const isHeader = tr.parentElement?.tagName === 'THEAD';
        const cell = document.createElement(isHeader ? 'th' : 'td');
        cell.contentEditable = 'true';
        cell.spellcheck = false;
        cell.textContent = 'Cell';
        cell.style.width = `${cellWidth}px`;
        if (cellHeight > 0) cell.style.height = `${cellHeight}px`;
        tr.appendChild(cell);
      }
      sync();
    });

    const rmCol = document.createElement('button');
    rmCol.className = 'cm-table-sq-btn';
    rmCol.textContent = '−';
    rmCol.title = 'Remove last column';
    rmCol.addEventListener('mousedown', (e) => e.preventDefault());
    rmCol.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const firstRow = table.querySelector('tr');
      if (!firstRow || firstRow.querySelectorAll('th').length <= 1) return;
      for (const tr of Array.from(table.querySelectorAll('tr'))) {
        const cells = tr.querySelectorAll('th, td');
        if (cells.length > 1) cells[cells.length - 1].remove();
      }
      sync();
    });

    colBar.appendChild(addCol);
    colBar.appendChild(rmCol);
    wrap.appendChild(colBar);

    const rowBar = document.createElement('div');
    rowBar.className = 'cm-table-row-bar';

    const rmRow = document.createElement('button');
    rmRow.className = 'cm-table-sq-btn';
    rmRow.textContent = '−';
    rmRow.title = 'Remove last row';
    rmRow.addEventListener('mousedown', (e) => e.preventDefault());
    rmRow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bodyRows = tbody.querySelectorAll('tr');
      if (bodyRows.length === 0) return;
      bodyRows[bodyRows.length - 1].remove();
      sync();
    });

    const addRow = document.createElement('button');
    addRow.className = 'cm-table-sq-btn';
    addRow.textContent = '+';
    addRow.title = 'Add row';
    addRow.addEventListener('mousedown', (e) => e.preventDefault());
    addRow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cols = table.querySelectorAll('thead tr:first-child th').length;
      const tr = document.createElement('tr');
      if (cellHeight > 0) (tr as HTMLElement).style.height = `${cellHeight}px`;
      for (let i = 0; i < cols; i++) {
        const td = document.createElement('td');
        td.contentEditable = 'true';
        td.spellcheck = false;
        td.textContent = 'Cell';
        td.style.width = `${cellWidth}px`;
        if (cellHeight > 0) td.style.height = `${cellHeight}px`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
      sync();
    });

    rowBar.appendChild(addRow);
    rowBar.appendChild(rmRow);
    wrap.appendChild(rowBar);

    // ---------------------------------------------------------------------
    // Resize — capture-phase listeners on document so `wrap`'s
    // stopPropagation can NEVER swallow the mouseup that ends the drag.
    // ---------------------------------------------------------------------
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 140;
    let startH = 40;

    const onMove = (ev: MouseEvent) => {
      if (!resizing) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      cellWidth = Math.max(60, startW + dx);
      cellHeight = Math.max(24, startH + dy);
      applyCurrentSize();
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      const firstCell = table.querySelector('th') as HTMLElement | null;
      startW = firstCell?.offsetWidth ?? cellWidth;
      startH = firstCell?.offsetHeight ?? (cellHeight || 40);
      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mouseup', onUp, true);
    });

    return wrap;
  }

  ignoreEvent() { return true; }
}
