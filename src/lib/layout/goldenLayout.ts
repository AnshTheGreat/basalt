import type { ComponentContainer } from 'golden-layout';
import { createEditorPane } from '../panes/editorPane';
import { createFileTreePane } from '../panes/fileTreePane';
import { createOutlinePane } from '../panes/outlinePane';
import { state, loadVault, openFile, FileNode } from '../vault/store';
import { showVaultWizard } from '../vault/wizard';

function findFirstMd(tree: FileNode[]): string | null {
  for (const n of tree) {
    if (n.isDir && n.children) {
      const f = findFirstMd(n.children);
      if (f) return f;
    } else if (n.name.endsWith('.md')) return n.path;
  }
  return null;
}

function makePane(cls: string, pane: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `basalt-pane ${cls}`;
  el.dataset.pane = pane;
  return el;
}

function makeSplitter(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'basalt-splitter';
  return el;
}

export function toggleFileTree() {
  const pane = document.querySelector('.basalt-pane-filetree') as HTMLElement | null;
  if (!pane) return;

  const hidden = pane.dataset.hidden === '1';

  if (hidden) {
    pane.dataset.hidden = '0';
    pane.style.display = '';
    const splitter = pane.nextElementSibling as HTMLElement | null;
    if (splitter && splitter.classList.contains('basalt-splitter')) {
      splitter.style.display = '';
    }
    requestAnimationFrame(() => {
      const tree = pane.querySelector('.tree-pane') as HTMLElement | null;
      tree?.focus();
    });
  } else {
    pane.dataset.hidden = '1';
    pane.style.display = 'none';
    const splitter = pane.nextElementSibling as HTMLElement | null;
    if (splitter && splitter.classList.contains('basalt-splitter')) {
      splitter.style.display = 'none';
    }
  }
}

export function toggleOutline() {
  const pane = document.querySelector('.basalt-pane-outline') as HTMLElement | null;
  if (!pane) return;

  const hidden = pane.dataset.hidden === '1';

  if (hidden) {
    pane.dataset.hidden = '0';
    pane.style.display = '';
    const splitter = pane.previousElementSibling as HTMLElement | null;
    if (splitter && splitter.classList.contains('basalt-splitter')) {
      splitter.style.display = '';
    }
  } else {
    pane.dataset.hidden = '1';
    pane.style.display = 'none';
    const splitter = pane.previousElementSibling as HTMLElement | null;
    if (splitter && splitter.classList.contains('basalt-splitter')) {
      splitter.style.display = 'none';
    }
  }
}

export async function initLayout() {
  const hasVault = await loadVault();
  if (!hasVault) {
    const ok = await showVaultWizard();
    if (!ok) return;
    if (!(await loadVault())) return;
  }

  const container = document.getElementById('layout-root')!;
  container.innerHTML = '';
  container.className = 'basalt-layout';

  const filetreePane = makePane('basalt-pane-filetree', 'filetree');
  const splitter1 = makeSplitter();
  const editorPane = makePane('basalt-pane-editor', 'editor');
  const splitter2 = makeSplitter();
  const outlinePane = makePane('basalt-pane-outline', 'outline');

  container.appendChild(filetreePane);
  container.appendChild(splitter1);
  container.appendChild(editorPane);
  container.appendChild(splitter2);
  container.appendChild(outlinePane);

  createFileTreePane({ element: filetreePane } as unknown as ComponentContainer);
  createEditorPane({ element: editorPane } as unknown as ComponentContainer);
  createOutlinePane({ element: outlinePane } as unknown as ComponentContainer);

  // Both side panes are hidden by default
  filetreePane.dataset.hidden = '1';
  filetreePane.style.display = 'none';
  splitter1.style.display = 'none';

  outlinePane.dataset.hidden = '1';
  outlinePane.style.display = 'none';
  splitter2.style.display = 'none';

  const first = findFirstMd(state.tree);
  if (first) await openFile(first);
}
