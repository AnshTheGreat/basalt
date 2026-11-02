import { WidgetType } from '@codemirror/view';
import { FileNode, openFile, state } from '../vault/store';

function resolveLink(name: string): string | null {
  function walk(nodes: FileNode[]): string | null {
    for (const n of nodes) {
      if (n.isDir && n.children) {
        const f = walk(n.children);
        if (f) return f;
      } else if (n.name === name || n.name === name + '.md') return n.path;
    }
    return null;
  }
  return walk(state.tree);
}

export class TreeLinkWidget extends WidgetType {
  constructor(readonly name: string) { super(); }

  eq(o: WidgetType) {
    return o instanceof TreeLinkWidget && o.name === this.name;
  }

  toDOM() {
    const s = document.createElement('span');
    const resolved = resolveLink(this.name);
    s.className = 'cm-treelink' + (resolved ? '' : ' cm-treelink-missing');
    s.textContent = this.name;
    s.title = resolved ? `Open ${resolved}` : `No file matches "${this.name}"`;
    if (resolved) {
      s.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFile(resolved);
      });
    }
    return s;
  }

  ignoreEvent() { return true; }
}
