import { FileNode, openFileInCurrentTab, refreshTree, state } from '../vault/store';
import { showInlineDialog, confirmDialog, showContextMenu } from '../ui';

const openFolders = new Set<string>();

interface Row {
  path: string;
  isDir: boolean;
  prefix: string;
  label: string;
}

function buildRows(nodes: FileNode[], prefix: string): Row[] {
  const rows: Row[] = [];
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const open = node.isDir && openFolders.has(node.path);
    const marker = node.isDir ? (open ? '▼ ' : '▶ ') : '';
    const name = node.isDir ? node.name + '/' : node.name;
    rows.push({
      path: node.path,
      isDir: node.isDir,
      prefix: prefix + branch,
      label: marker + name,
    });
    if (open && node.children) {
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      rows.push(...buildRows(node.children, nextPrefix));
    }
  });
  return rows;
}

async function renameEntry(path: string, isDir: boolean) {
  const oldName = path.split('/').pop() || path;
  const extIdx = isDir ? -1 : oldName.lastIndexOf('.');
  const selectEnd = extIdx > 0 ? extIdx : oldName.length;
  const newName = await showInlineDialog('Rename to', oldName, '', selectEnd);
  if (!newName || newName === oldName) return;
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const newPath = dir ? `${dir}/${newName}` : newName;
  await window.vaultAPI.rename(path, newPath);
  await refreshTree();
}

async function deleteEntry(path: string, isDir: boolean) {
  const ok = await confirmDialog(`Delete ${isDir ? 'folder' : 'file'} "${path}"?`, 'Delete');
  if (!ok) return;
  await window.vaultAPI.remove(path);
  await refreshTree();
}

export function openTreeView() {
  const existing = document.getElementById('tree-view');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tree-view';
  overlay.className = 'cmd-palette-overlay tree-overlay';
  overlay.innerHTML = `
    <div class="cmd-palette tree-palette">
      <div class="graph-header">
        <span class="graph-title">Vault Tree</span>
        <span class="graph-subtitle"></span>
      </div>
      <div class="tree-body"></div>
      <div class="tree-hint">↑ ↓ navigate · → open folder · ← close folder · Enter open/toggle · Insert/0 menu · Esc close</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const body = overlay.querySelector('.tree-body') as HTMLElement;
  const subtitle = overlay.querySelector('.graph-subtitle') as HTMLElement;
  const vaultName = state.vaultPath?.split(/[\\/]/).filter(Boolean).pop() || 'vault';
  subtitle.textContent = state.vaultPath || '';

  let rows: Row[] = [];
  let rowEls: HTMLElement[] = [];
  let selected = 0;

  const cleanup = () => {
    overlay.remove();
    document.removeEventListener('keydown', keyHandler, true);
  };

  const updateSelected = () => {
    rowEls.forEach((el, i) => el.classList.toggle('selected', i === selected));
    rowEls[selected]?.scrollIntoView({ block: 'nearest' });
  };

  const render = () => {
    body.innerHTML = '';
    rowEls = [];

    const rootRow = document.createElement('div');
    rootRow.className = 'tree-row dir root-row';
    rootRow.textContent = vaultName + '/';
    body.appendChild(rootRow);

    rows = buildRows(state.tree, '');
    rows.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'tree-row' + (row.isDir ? ' dir' : ' file');
      el.textContent = row.prefix + row.label;
      if (!row.isDir && row.path === state.activeTab) el.classList.add('active');
      body.appendChild(el);
      rowEls.push(el);
    });

    if (rowEls.length > 0) {
      if (selected >= rowEls.length) selected = rowEls.length - 1;
      updateSelected();
    }
  };

  // Preselect the active file's row if it exists
  const active = state.activeTab;
  if (active) {
    const tmpRows = buildRows(state.tree, '');
    for (let i = 0; i < tmpRows.length; i++) {
      if (!tmpRows[i].isDir && tmpRows[i].path === active) { selected = i; break; }
    }
  }

  render();

  const openMenu = () => {
    const row = rows[selected];
    const el = rowEls[selected];
    if (!row || !el) return;
    const rect = el.getBoundingClientRect();
    showContextMenu(rect.left + 24, rect.bottom + 4, [
      { label: 'Rename', action: () => void renameEntry(row.path, row.isDir).then(() => { render(); }) },
      { label: 'Delete', action: () => void deleteEntry(row.path, row.isDir).then(() => { render(); }) },
    ]);
  };

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selected < rowEls.length - 1) { selected++; updateSelected(); }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selected > 0) { selected--; updateSelected(); }
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const row = rows[selected];
      if (row && row.isDir && !openFolders.has(row.path)) {
        openFolders.add(row.path);
        render();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const row = rows[selected];
      if (row && row.isDir && openFolders.has(row.path)) {
        openFolders.delete(row.path);
        render();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[selected];
      if (!row) return;
      if (row.isDir) {
        if (openFolders.has(row.path)) openFolders.delete(row.path);
        else openFolders.add(row.path);
        render();
      } else {
        openFileInCurrentTab(row.path);
        cleanup();
      }
      return;
    }
    if (e.key === 'Insert' || e.key === '0') {
      e.preventDefault();
      openMenu();
      return;
    }
  };

  document.addEventListener('keydown', keyHandler, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
}
