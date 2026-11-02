import type { ComponentContainer } from 'golden-layout';
import {
  FileNode, openFileInCurrentTab, state, subscribe, refreshTree, setEditingFile,
} from '../vault/store';
import { showInlineDialog, confirmDialog, showContextMenu } from '../ui';

const openFolders = new Set<string>();
let selectedIdx = 0;
let visibleRows: { node: FileNode; el: HTMLElement; depth: number }[] = [];
let bodyEl: HTMLElement | null = null;
let paneEl: HTMLElement | null = null;

function ensureFolderOpen(path: string) {
  const parts = path.split('/');
  let cur = '';
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i];
    openFolders.add(cur);
  }
}

interface Row { node: FileNode; depth: number; }

function buildRows(nodes: FileNode[], depth: number = 0): Row[] {
  const rows: Row[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.isDir && openFolders.has(node.path) && node.children) {
      rows.push(...buildRows(node.children, depth + 1));
    }
  }
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

function updateSelected() {
  visibleRows.forEach((r, i) => r.el.classList.toggle('selected', i === selectedIdx));
  visibleRows[selectedIdx]?.el.scrollIntoView({ block: 'nearest' });
}

function render() {
  if (!bodyEl) return;

  if (state.editingFile) ensureFolderOpen(state.editingFile);

  bodyEl.innerHTML = '';
  visibleRows = [];

  const rows = buildRows(state.tree);

  rows.forEach((row, i) => {
    const { node, depth } = row;
    const el = document.createElement('div');
    el.className = 'tree-item';
    el.style.paddingLeft = `${8 + depth * 12}px`;

    if (node.isDir) {
      el.classList.add('dir');
      const marker = openFolders.has(node.path) ? '▾ ' : '▸ ';
      el.textContent = marker + node.name;
    } else {
      el.classList.add('file');
      if (node.path === state.currentFile) el.classList.add('active');
      el.textContent = '  ' + node.name;
    }

    if (i === selectedIdx) el.classList.add('selected');

    if (!node.isDir && node.path === state.editingFile) {
      el.textContent = '';
      el.classList.remove('active');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tree-item-input';
      input.value = node.name;
      input.spellcheck = false;
      input.autocomplete = 'off';

      const extIdx = node.name.lastIndexOf('.');
      const selectEnd = extIdx > 0 ? extIdx : node.name.length;

      let done = false;
      const finish = async (commit: boolean) => {
        if (done) return;
        done = true;
        const newName = input.value.trim();
        setEditingFile(null);
        if (commit && newName && newName !== node.name) {
          try {
            const dir = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '';
            const newPath = dir ? `${dir}/${newName}` : newName;
            await window.vaultAPI.rename(node.path, newPath);
            if (state.currentFile === node.path) await openFileInCurrentTab(newPath);
          } catch (err) { console.error('Rename failed', err); }
        }
        await refreshTree();
        paneEl?.focus();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
      el.appendChild(input);

      setTimeout(() => {
        if (!input.isConnected) return;
        input.focus();
        input.setSelectionRange(0, selectEnd);
      }, 0);
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedIdx = i;
      if (node.isDir) {
        if (openFolders.has(node.path)) openFolders.delete(node.path);
        else openFolders.add(node.path);
        render();
      } else {
        openFileInCurrentTab(node.path);
        updateSelected();
      }
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedIdx = i;
      updateSelected();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Rename', action: () => void renameEntry(node.path, node.isDir) },
        { label: 'Delete', action: () => void deleteEntry(node.path, node.isDir) },
      ]);
    });

    if (!node.isDir) {
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('application/x-basalt-path', node.path);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
      });
    }

    bodyEl!.appendChild(el);
    visibleRows.push({ node, el, depth });
  });

  if (selectedIdx >= visibleRows.length) selectedIdx = Math.max(0, visibleRows.length - 1);
  updateSelected();
}

export function createFileTreePane(container: ComponentContainer) {
  paneEl = document.createElement('div');
  paneEl.className = 'tree-pane';
  paneEl.tabIndex = 0;
  container.element.appendChild(paneEl);

  bodyEl = document.createElement('div');
  bodyEl.className = 'tree-body';
  paneEl.appendChild(bodyEl);

  paneEl.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (visibleRows.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectedIdx < visibleRows.length - 1) { selectedIdx++; updateSelected(); }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectedIdx > 0) { selectedIdx--; updateSelected(); }
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const row = visibleRows[selectedIdx];
      if (row && row.node.isDir && !openFolders.has(row.node.path)) {
        openFolders.add(row.node.path);
        render();
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const row = visibleRows[selectedIdx];
      if (row && row.node.isDir && openFolders.has(row.node.path)) {
        openFolders.delete(row.node.path);
        render();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = visibleRows[selectedIdx];
      if (!row) return;
      if (row.node.isDir) {
        if (openFolders.has(row.node.path)) openFolders.delete(row.node.path);
        else openFolders.add(row.node.path);
        render();
      } else {
        openFileInCurrentTab(row.node.path);
        updateSelected();
      }
      return;
    }
    if (e.key === 'Insert' || e.key === '0') {
      e.preventDefault();
      // Toggle: if a context menu is already open, close it and bail.
      const existing = document.querySelector('.context-menu');
      if (existing) {
        existing.remove();
        return;
      }
      const row = visibleRows[selectedIdx];
      if (!row) return;
      const rect = row.el.getBoundingClientRect();
      showContextMenu(rect.left + 24, rect.bottom + 2, [
        { label: 'Rename', action: () => void renameEntry(row.node.path, row.node.isDir) },
        { label: 'Delete', action: () => void deleteEntry(row.node.path, row.node.isDir) },
      ]);
      return;
    }
  });

  paneEl.addEventListener('mousedown', (e) => {
    if (e.target === paneEl || e.target === bodyEl) paneEl!.focus();
  });

  if (state.currentFile) ensureFolderOpen(state.currentFile);

  const findActiveIdx = () => {
    if (!state.currentFile) return 0;
    const rows = buildRows(state.tree);
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].node.isDir && rows[i].node.path === state.currentFile) return i;
    }
    return 0;
  };

  selectedIdx = findActiveIdx();
  subscribe(render);
  render();
}
