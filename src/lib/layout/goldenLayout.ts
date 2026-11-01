import { GoldenLayout, LayoutConfig } from 'golden-layout';
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

export async function initLayout() {
  const hasVault = await loadVault();
  if (!hasVault) {
    await showVaultWizard();
    if (!(await loadVault())) return;
  }

  const container = document.getElementById('layout-root')!;
  const layout = new GoldenLayout(container);

  layout.registerComponentFactoryFunction('filetree', createFileTreePane);
  layout.registerComponentFactoryFunction('editor', createEditorPane);
  layout.registerComponentFactoryFunction('outline', createOutlinePane);

  const config: LayoutConfig = {
    root: {
      type: 'row',
      content: [
        {
          type: 'column',
          width: 18,
          content: [
            { type: 'component', componentType: 'filetree', title: 'Vault', isClosable: false, reorderEnabled: true },
          ],
        },
        {
          type: 'component',
          componentType: 'editor',
          title: 'Editor',
          width: 64,
          isClosable: false,
          reorderEnabled: true,
        },
        {
          type: 'column',
          width: 18,
          content: [
            { type: 'component', componentType: 'outline', title: 'Outline', isClosable: false, reorderEnabled: true },
          ],
        },
      ],
    },
  };
  layout.loadLayout(config);

  // Safety net — GLv2 has a ResizeObserver internally, but some Electron
  // builds need an explicit nudge on window resize.
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      const anyLayout = layout as any;
      try { anyLayout.updateRootSize?.(); } catch { /* ignore */ }
      try { anyLayout.updateSize?.(); } catch { /* ignore */ }
    });
  });

  const first = findFirstMd(state.tree);
  if (first) await openFile(first);
}
