import { EditorView } from '@codemirror/view';
import {
  state, loadVault, createFile, openFile, setEditingFile, refreshTree,
  isUntitled, closeTab, notify,
} from '../vault/store';
import { showInlineDialog, confirmDialog } from '../ui';
import { getEditorView } from './editorPane';
import { detectKind, isTextKind } from '../viewers';

interface Command { id: string; label: string; hint?: string; run: () => void | Promise<void>; }

function currentDir(): string {
  const path = state.activeTab;
  if (!path || isUntitled(path)) return '';
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function makeCommands(view: EditorView | null): Command[] {
  return [
    {
      id: 'change-vault',
      label: 'Change Vault',
      hint: 'Open the folder picker to switch vaults',
      run: async () => {
        const p = await window.vaultAPI.chooseVault();
        if (p) await loadVault();
      },
    },
    {
      id: 'new-note',
      label: 'New Note',
      hint: 'Create a note in the current folder',
      run: async () => {
        const dir = currentDir();
        const rand = Math.floor(Math.random() * 1_000_000);
        const rel = dir ? `${dir}/note_${rand}.md` : `note_${rand}.md`;
        try { await createFile(rel); await openFile(rel); setEditingFile(rel); }
        catch (err) { console.error(err); }
      },
    },
    {
      id: 'new-folder',
      label: 'New Folder',
      hint: 'Create a folder in the current location',
      run: async () => {
        const dir = currentDir();
        const name = await showInlineDialog('New folder name');
        if (!name) return;
        const rel = dir ? `${dir}/${name}` : name;
        await window.vaultAPI.mkdir(rel);
        await refreshTree();
      },
    },
    {
      id: 'import-file',
      label: 'Import File',
      hint: 'Insert a media embed at the cursor',
      run: async () => {
        if (!state.currentFile) return;
        if (!isTextKind(detectKind(state.currentFile))) return;
        const v = getEditorView();
        if (!v) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,audio/*,video/*,application/pdf';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file) return;
          const buf = await file.arrayBuffer();
          const rel = await window.vaultAPI.importFile(file.name, buf);
          const alias = file.name.replace(/\.[^.]+$/, '');
          const insert = `f"${alias}"_"${rel}"`;
          const pos = v.state.selection.main.head;
          v.dispatch({
            changes: { from: pos, to: pos, insert },
            selection: { anchor: pos + insert.length },
          });
        });
        input.click();
      },
    },
    {
      id: 'rename-file',
      label: 'Rename Current File',
      hint: 'Rename the active file',
      run: async () => {
        const path = state.activeTab;
        if (!path || isUntitled(path)) return;
        const oldName = path.split('/').pop() || path;
        const extIdx = oldName.lastIndexOf('.');
        const selectEnd = extIdx > 0 ? extIdx : oldName.length;
        const newName = await showInlineDialog('Rename to', oldName, '', selectEnd);
        if (!newName || newName === oldName) return;
        const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const newPath = dir ? `${dir}/${newName}` : newName;
        await window.vaultAPI.rename(path, newPath);

        const idx = state.tabs.indexOf(path);
        if (idx >= 0) {
          state.tabs[idx] = newPath;
          if (state.contents.has(path)) {
            const content = state.contents.get(path)!;
            state.contents.delete(path);
            state.contents.set(newPath, content);
          }
          const cursor = state.cursors.get(path);
          state.cursors.delete(path);
          if (cursor !== undefined) state.cursors.set(newPath, cursor);
          if (state.activeTab === path) state.activeTab = newPath;
        }
        await refreshTree();
        notify();
      },
    },
    {
      id: 'delete-file',
      label: 'Delete Current File',
      hint: 'Permanently delete the active file',
      run: async () => {
        const path = state.activeTab;
        if (!path || isUntitled(path)) return;
        const ok = await confirmDialog(`Delete "${path}"?`, 'Delete');
        if (!ok) return;
        await window.vaultAPI.remove(path);
        closeTab(path);
        await refreshTree();
      },
    },
  ];
}

export function openCommandPalette(view: EditorView | null) {
  const existing = document.getElementById('cmd-palette');
  if (existing) existing.remove();

  const savedSel = view
    ? { anchor: view.state.selection.main.anchor, head: view.state.selection.main.head }
    : null;
  const commands = makeCommands(view);

  const overlay = document.createElement('div');
  overlay.id = 'cmd-palette';
  overlay.className = 'cmd-palette-overlay';
  overlay.innerHTML = `
    <div class="cmd-palette">
      <input type="text" placeholder="Type a command…" />
      <div class="cmd-palette-list"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('input') as HTMLInputElement;
  const list = overlay.querySelector('.cmd-palette-list') as HTMLElement;

  let filtered: Command[] = commands.slice();
  let selected = 0;

  const updateSelected = () => {
    const items = list.querySelectorAll('.cmd-palette-item');
    items.forEach((el, i) => el.classList.toggle('selected', i === selected));
    items[selected]?.scrollIntoView({ block: 'nearest' });
  };

  const render = () => {
    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<div class="cmd-palette-empty">No matching commands</div>';
      return;
    }
    filtered.forEach((cmd, i) => {
      const el = document.createElement('div');
      el.className = 'cmd-palette-item';
      el.innerHTML = `
        <div class="cmd-palette-item-main">
          <span class="cmd-palette-item-label">${cmd.label}</span>
          ${cmd.hint ? `<span class="cmd-palette-item-hint">${cmd.hint}</span>` : ''}
        </div>
      `;
      el.addEventListener('mouseenter', () => { selected = i; updateSelected(); });
      el.addEventListener('click', () => execute(i));
      list.appendChild(el);
    });
    updateSelected();
  };

  const close = () => {
    overlay.remove();
    if (view && savedSel) {
      view.dispatch({ selection: { anchor: savedSel.anchor, head: savedSel.head } });
      view.focus();
    }
  };

  const execute = async (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    close();
    try { await cmd.run(); }
    catch (err) { console.error('Command failed', err); }
  };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    filtered = q
      ? commands.filter(
          (c) =>
            c.label.toLowerCase().includes(q) ||
            (c.hint?.toLowerCase().includes(q) ?? false),
        )
      : commands.slice();
    selected = 0;
    render();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selected < filtered.length - 1) { selected++; updateSelected(); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selected > 0) { selected--; updateSelected(); }
    } else if (e.key === 'Enter') { e.preventDefault(); execute(selected); }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  render();
  input.focus();
}
