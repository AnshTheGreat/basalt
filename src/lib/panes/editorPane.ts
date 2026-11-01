import { ComponentContainer } from 'golden-layout';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { livePreviewField, atomicColorField } from '../editor/livePreview';
import { continueTaskOnEnter, continueBulletOnEnter, handleQuote } from '../editor/handlers';
import { handleSlashSpace } from '../editor/slashCommands';
import { dragState } from '../editor/dragState';
import { emitOutline, parseHeadings, setOutlineNavigator, setActiveLine } from './outlinePane';
import { openCommandPalette } from './palettePane';
import { openFile, saveFile, state, subscribe, refreshTree } from '../vault/store';

const PLACEHOLDER =
  '# No note open\n\nSelect a note from the sidebar, or click **+ New note** to create one.';

let view: EditorView | null = null;
let outlineTimer: number | null = null;
let loadedFile: string | null = null;
let hoverLine = -1;

const lockComp = new Compartment();

function scheduleOutline() {
  if (outlineTimer !== null) window.clearTimeout(outlineTimer);
  outlineTimer = window.setTimeout(() => {
    if (view) emitOutline(parseHeadings(view.state.doc.toString()));
  }, 100);
}

export function createEditorPane(container: ComponentContainer) {
  const host = document.createElement('div');
  host.className = 'editor-host';
  container.element.appendChild(host);

  view = new EditorView({
    state: EditorState.create({
      doc: PLACEHOLDER,
      extensions: [
        lockComp.of([EditorView.editable.of(false), EditorState.readOnly.of(true)]),
        history(),
        closeBrackets(),
        autocompletion(),
        keymap.of([
          { key: 'Enter', run: continueTaskOnEnter },
          { key: 'Enter', run: continueBulletOnEnter },
          { key: ' ', run: handleSlashSpace },
          { key: "'", run: handleQuote },
          {
            key: 'Mod-Shift-p',
            run: () => { openCommandPalette(view); return true; },
          },
          {
            key: 'Mod-s',
            run: (v) => {
              if (state.currentFile) saveFile(v.state.doc.toString()).catch(console.error);
              return true;
            },
          },
        ]),
        markdown(),
        livePreviewField,
        atomicColorField,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            scheduleOutline();
            // NO scheduleSave() — autosave is disabled.
          }
        }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: '#1e1e1e' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'Fira Code', monospace" },
          '.cm-content': { padding: '16px', caretColor: '#569cd6' },
          '.cm-cursor': { borderLeftColor: '#569cd6' },
        }),
      ],
    }),
    parent: host,
  });

  emitOutline([]);

  // Safety: any leftover `cursor` style from a table drag is cleared here.
  view.dom.addEventListener('mouseup', () => {
    if (document.body.style.cursor) document.body.style.cursor = '';
  });

  view.dom.addEventListener('mousemove', (e) => {
    const pos = view!.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;
    const line = view!.state.doc.lineAt(pos).number - 1;
    if (line !== hoverLine) {
      hoverLine = line;
      setActiveLine(line);
    }
  });

  setOutlineNavigator((line) => {
    if (!view) return;
    const l = Math.min(line + 1, view.state.doc.lines);
    view.dispatch({ selection: { anchor: view.state.doc.line(l).from }, scrollIntoView: true });
    view.focus();
  });

  subscribe(() => {
    if (!view) return;
    if (state.currentFile !== loadedFile) {
      loadedFile = state.currentFile;
      const content = state.currentFile ? state.currentContent : PLACEHOLDER;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        effects: lockComp.reconfigure(
          state.currentFile
            ? [EditorView.editable.of(true), EditorState.readOnly.of(false)]
            : [EditorView.editable.of(false), EditorState.readOnly.of(true)],
        ),
      });
      emitOutline(parseHeadings(content));
    }
  });

  view.dom.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer) return;
    const fromExplorer = e.dataTransfer.types.includes('application/x-basalt-path');
    e.dataTransfer.dropEffect = fromExplorer ? 'copy' : (dragState.current ? 'move' : 'copy');
  });

  view.dom.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!state.currentFile || !view) return;

    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;

    const explorerPath = e.dataTransfer?.getData('application/x-basalt-path');
    if (explorerPath) {
      const name = explorerPath.split('/').pop()?.replace(/\.[^.]+$/, '') || explorerPath;
      const insert = `f'${name}'_'${explorerPath}'`;
      view.dispatch({
        changes: { from: pos, to: pos, insert },
        selection: { anchor: pos + insert.length },
      });
      return;
    }

    if (dragState.current) {
      const { from, to, text } = dragState.current;
      dragState.current = null;
      if (pos >= from && pos <= to) return;
      if (pos <= from) {
        view.dispatch({
          changes: [
            { from: pos, to: pos, insert: text },
            { from: from + text.length, to: to + text.length, insert: '' },
          ],
        });
      } else {
        view.dispatch({
          changes: [
            { from, to, insert: '' },
            { from: pos - (to - from), to: pos - (to - from), insert: text },
          ],
        });
      }
      return;
    }

    const files = Array.from(e.dataTransfer?.files || []);
    let insertAt = pos;
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const rel = await window.vaultAPI.importFile(file.name, buf);
        const name = file.name.replace(/\.[^.]+$/, '');
        const insert = `\nf'${name}'_'${rel}'\n`;
        view.dispatch({
          changes: { from: insertAt, to: insertAt, insert },
          selection: { anchor: insertAt + insert.length },
        });
        insertAt += insert.length;
      } catch (err) {
        console.error('Import failed', err);
      }
    }
    await refreshTree();
  });
}
