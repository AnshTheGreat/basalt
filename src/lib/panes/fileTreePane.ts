import { ComponentContainer } from 'golden-layout';
import { FileNode, openFile, state, subscribe, createFile, refreshTree } from '../vault/store';

function showDialog(title: string, defaultValue = '', placeholder = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'inline-dialog-overlay';
    overlay.innerHTML = `
      <div class="inline-dialog">
        <label>${title}</label>
        <input type="text" placeholder="${placeholder}" />
        <div class="inline-dialog-actions">
          <button data-act="cancel">Cancel</button>
          <button data-act="ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input')!;
    input.value = defaultValue;
    input.focus();
    input.select();
    const close = (v: string | null) => { overlay.remove(); resolve(v); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim() || null);
      if (e.key === 'Escape') close(null);
    });
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => close(input.value.trim() || null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
  });
}

function showContextMenu(x: number, y: number, items: { label: string; action: () => void }[]) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'context-menu-item';
    el.textContent = item.label;
    el.addEventListener('click', () => { menu.remove(); item.action(); });
    menu.appendChild(el);
  }
  document.body.appendChild(menu);

  const close = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('mousedown', close, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
}

function renderTree(nodes: FileNode[]): HTMLElement {
  const ul = document.createElement('ul');
  ul.className = 'tree-list';
  for (const node of nodes) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.className = 'tree-item' + (node.path === state.currentFile ? ' active' : '');
    span.draggable = true;

    span.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('application/x-basalt-path', node.path);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
    });

    span.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const items = [];
      if (node.isDir) {
        items.push({
          label: 'New File',
          action: async () => {
            const name = await showDialog('New file name', '', 'notes.md');
            if (!name) return;
            const rel = `${node.path}/${name.endsWith('.md') ? name : name + '.md'}`;
            await createFile(rel);
          },
        });
        items.push({
          label: 'New Folder',
          action: async () => {
            const name = await showDialog('New folder name');
            if (!name) return;
            await window.vaultAPI.mkdir(`${node.path}/${name}`);
            await refreshTree();
          },
        });
      }
      items.push({
        label: 'Rename',
        action: async () => {
          const name = await showDialog('Rename to', node.name);
          if (!name || name === node.name) return;
          const dir = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/')) : '';
          const newPath = dir ? `${dir}/${name}` : name;
          await window.vaultAPI.rename(node.path, newPath);
          if (state.currentFile === node.path) {
            await openFile(newPath);
          }
          await refreshTree();
        },
      });
      items.push({
        label: 'Delete',
        action: async () => {
          const ok = await showDialog('Type DELETE to confirm', '', 'DELETE');
          if (ok !== 'DELETE') return;
          await window.vaultAPI.remove(node.path);
          await refreshTree();
        },
      });
      showContextMenu(e.clientX, e.clientY, items);
    });

    if (node.isDir) {
      const sub = document.createElement('div');
      sub.className = 'tree-children';
      span.textContent = '▸ ' + node.name;
      li.appendChild(span);
      if (node.children) sub.appendChild(renderTree(node.children));
      li.appendChild(sub);
      let open = false;
      span.addEventListener('click', () => {
        open = !open;
        span.textContent = (open ? '▾ ' : '▸ ') + node.name;
        sub.style.display = open ? 'block' : 'none';
      });
    } else {
      span.textContent = '📄 ' + node.name;
      span.addEventListener('click', () => openFile(node.path));
      li.appendChild(span);
    }
    ul.appendChild(li);
  }
  return ul;
}

export function createFileTreePane(container: ComponentContainer) {
  const wrap = document.createElement('div');
  wrap.className = 'tree-pane';
  container.element.appendChild(wrap);

  const newBtn = document.createElement('button');
  newBtn.className = 'tree-new-btn';
  newBtn.textContent = '+ New note';
  newBtn.addEventListener('click', async () => {
    const name = await showDialog('New file name', '', 'notes.md');
    if (!name) return;
    const rel = name.endsWith('.md') ? name : name + '.md';
    try {
      await createFile(rel);
      await openFile(rel);
    } catch (err) {
      console.error(err);
    }
  });
  wrap.appendChild(newBtn);

  const body = document.createElement('div');
  wrap.appendChild(body);

  body.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('.tree-item')) return;
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, [
      {
        label: 'New File at Root',
        action: async () => {
          const name = await showDialog('New file name', '', 'notes.md');
          if (!name) return;
          await createFile(name.endsWith('.md') ? name : name + '.md');
        },
      },
      {
        label: 'New Folder at Root',
        action: async () => {
          const name = await showDialog('New folder name');
          if (!name) return;
          await window.vaultAPI.mkdir(name);
          await refreshTree();
        },
      },
    ]);
  });

  const render = () => {
    body.innerHTML = '';
    if (state.tree.length === 0) {
      body.textContent = 'Vault is empty';
      return;
    }
    body.appendChild(renderTree(state.tree));
  };

  subscribe(render);
  render();
}
