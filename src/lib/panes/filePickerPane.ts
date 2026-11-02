import { FileNode, state } from '../vault/store';

interface FileEntry { path: string; name: string; }

function collectFiles(): FileEntry[] {
  const files: FileEntry[] = [];
  function walk(nodes: FileNode[]) {
    for (const n of nodes) {
      if (n.isDir && n.children) walk(n.children);
      else if (n.name.endsWith('.md')) files.push({ path: n.path, name: n.name });
    }
  }
  walk(state.tree);
  return files;
}

export function openFilePicker(onPick: (path: string) => void) {
  const existing = document.getElementById('file-picker');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'file-picker';
  overlay.className = 'cmd-palette-overlay';
  overlay.innerHTML = `
    <div class="cmd-palette">
      <input type="text" placeholder="Pick a file to open in a new tab…" />
      <div class="cmd-palette-list"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('input') as HTMLInputElement;
  const list = overlay.querySelector('.cmd-palette-list') as HTMLElement;

  const all = collectFiles();
  let filtered: FileEntry[] = all.slice();
  let selected = 0;

  const updateSelected = () => {
    list.querySelectorAll('.cmd-palette-item')
      .forEach((el, i) => el.classList.toggle('selected', i === selected));
  };

  const render = () => {
    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<div class="cmd-palette-empty">No files match</div>';
      return;
    }
    filtered.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'cmd-palette-item';
      el.innerHTML = `
        <div class="cmd-palette-item-main">
          <span class="cmd-palette-item-label">${f.name}</span>
          <span class="cmd-palette-item-hint">${f.path}</span>
        </div>
      `;
      el.addEventListener('mouseenter', () => { selected = i; updateSelected(); });
      el.addEventListener('click', () => pick(i));
      list.appendChild(el);
    });
    updateSelected();
  };

  const close = () => overlay.remove();

  const pick = (i: number) => {
    const f = filtered[i];
    if (!f) return;
    close();
    onPick(f.path);
  };

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    filtered = q
      ? all.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      : all.slice();
    selected = 0;
    render();
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filtered.length === 0) return;
      selected = (selected + 1) % filtered.length;
      updateSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filtered.length === 0) return;
      selected = (selected - 1 + filtered.length) % filtered.length;
      updateSelected();
    } else if (e.key === 'Enter') { e.preventDefault(); pick(selected); }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  render();
  input.focus();
}
