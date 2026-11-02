import { getEditorView } from './panes/editorPane';
import { openCommandPalette } from './panes/palettePane';
import { toggleFileTree, toggleOutline } from './layout/goldenLayout';
import { closeTab, isUntitled, newEmptyTab, saveFile, state, switchTab } from './vault/store';

function isOverlayOpen(): boolean {
  return !!(
    document.querySelector('.cmd-palette-overlay') ||
    document.querySelector('.inline-dialog-overlay')
  );
}

function saveEverything() {
  // Flush canvases and code blocks first
  document.querySelectorAll('canvas').forEach((c) => {
    c.dispatchEvent(new Event('basalt:save'));
  });
  document.querySelectorAll('.cm-code-block').forEach((b) => {
    b.dispatchEvent(new Event('basalt:save'));
  });

  // Then persist the current text buffer (state may have just changed)
  if (state.activeTab && !isUntitled(state.activeTab)) {
    requestAnimationFrame(() => {
      const view = getEditorView();
      const content = view ? view.state.doc.toString() : (state.contents.get(state.activeTab!) ?? '');
      void saveFile(content);
    });
  }
}

export function installShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    // Ctrl+[ / Ctrl+] — layout toggles, handled FIRST so they always work.
    if (e.code === 'BracketLeft') {
      e.preventDefault();
      e.stopPropagation();
      toggleFileTree();
      return;
    }
    if (e.code === 'BracketRight') {
      e.preventDefault();
      e.stopPropagation();
      toggleOutline();
      return;
    }

    // Ctrl+\ — command palette.
    if (e.code === 'Backslash') {
      e.preventDefault();
      e.stopPropagation();
      openCommandPalette(getEditorView());
      return;
    }

    // Ctrl+S — save everything.
    if (!e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      saveEverything();
      return;
    }

    if (isOverlayOpen()) return;

    if (!e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault(); e.stopPropagation();
      newEmptyTab();
      return;
    }

    if (!e.shiftKey && e.key.toLowerCase() === 'w') {
      e.preventDefault(); e.stopPropagation();
      if (state.activeTab) closeTab(state.activeTab);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      switchTab(e.shiftKey ? -1 : 1);
      return;
    }
  }, true);
}
