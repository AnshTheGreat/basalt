import { EditorView } from '@codemirror/view';

export function openCommandPalette(view: EditorView | null) {
  const existing = document.getElementById('cmd-palette');
  if (existing) existing.remove();

  // Save the selection so we can restore it on close
  const savedSel = view ? { anchor: view.state.selection.main.anchor, head: view.state.selection.main.head } : null;

  const overlay = document.createElement('div');
  overlay.id = 'cmd-palette';
  overlay.className = 'cmd-palette-overlay';
  overlay.innerHTML = `
    <div class="cmd-palette">
      <input type="text" placeholder="Type a command…" autofocus />
      <div class="cmd-palette-list">
        <div class="cmd-palette-empty">Command palette is a placeholder — no commands wired yet.</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (view && savedSel) {
      view.dispatch({ selection: { anchor: savedSel.anchor, head: savedSel.head } });
      view.focus();
    }
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  (overlay.querySelector('input') as HTMLInputElement).focus();
}
