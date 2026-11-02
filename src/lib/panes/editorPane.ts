import { ComponentContainer } from 'golden-layout';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap, autocompletion } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { livePreviewField, atomicColorField } from '../editor/livePreview';
import {
  continueTaskOnEnter, continueBulletOnEnter, handleQuote, handleSingleQuote,
} from '../editor/handlers';
import { handleSlashSpace, slashCommandCompletions } from '../editor/slashCommands';
import { dragState } from '../editor/dragState';
import { emitOutline, parseHeadings, setOutlineNavigator, setActiveLine } from './outlinePane';
import { openFile, refreshTree, state, subscribe, closeTab, notify, isUntitled } from '../vault/store';
import { detectKind, isTextKind, renderViewer } from '../viewers';

const PLACEHOLDER =
  '# No note open\n\nSelect a note from the sidebar, or use the command palette (Ctrl+\\) to create one.';

const EMPTY_TAB_PLACEHOLDER =
  '# New tab\n\n' +
  'This tab is empty. Load a file into it by:\n\n' +
  '- Clicking a file in the left sidebar\n' +
  '- Using **Ctrl+\\ → New Note**\n' +
  '- Dragging a file from the sidebar into this tab\n\n' +
  'Press **Ctrl+W** to close this tab.';

let view: EditorView | null = null;
let outlineTimer: number | null = null;
let loadedFile: string | null = null;
let hoverLine = -1;
let tabBar: HTMLElement | null = null;

const lockComp = new Compartment();

export function getEditorView(): EditorView | null { return view; }

function scheduleOutline() {
  if (outlineTimer !== null) window.clearTimeout(outlineTimer);
  outlineTimer = window.setTimeout(() => {
    if (view) emitOutline(parseHeadings(view.state.doc.toString()));
  }, 100);
}

function renderTabs() {
  if (!tabBar) return;
  tabBar.innerHTML = '';
  if (state.tabs.length === 0) { tabBar.style.display = 'none'; return; }
  tabBar.style.display = 'flex';
  for (const path of state.tabs) {
    const name = isUntitled(path) ? 'New Tab' : (path.split('/').pop() || path);
    const tab = document.createElement('div');
    tab.className = 'tab' + (path === state.activeTab ? ' active' : '');
    tab.title = isUntitled(path) ? 'Empty tab' : path;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = name;
    tab.appendChild(label);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close tab (Ctrl+W)';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeTab(path); });
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => {
      if (path !== state.activeTab) { state.activeTab = path; notify(); }
    });

    tabBar.appendChild(tab);
  }
}

export function createEditorPane(container: ComponentContainer) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  container.element.appendChild(wrap);

  tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  wrap.appendChild(tabBar);

  const contentWrap = document.createElement('div');
  contentWrap.className = 'editor-content';
  wrap.appendChild(contentWrap);

  const cmHost = document.createElement('div');
  cmHost.className = 'editor-host';
  contentWrap.appendChild(cmHost);

  const viewerHost = document.createElement('div');
  viewerHost.className = 'viewer-host';
  viewerHost.style.display = 'none';
  contentWrap.appendChild(viewerHost);

  view = new EditorView({
    state: EditorState.create({
      doc: PLACEHOLDER,
      extensions: [
        lockComp.of([EditorView.editable.of(false), EditorState.readOnly.of(true)]),
        history(),
        closeBrackets(),
        autocompletion({ override: [slashCommandCompletions] }),
        keymap.of([
          { key: 'Enter', run: continueTaskOnEnter },
          { key: 'Enter', run: continueBulletOnEnter },
          { key: ' ', run: handleSlashSpace },
          { key: '"', run: handleQuote },
          { key: "'", run: handleSingleQuote },
        ]),
        markdown(),
        livePreviewField,
        atomicColorField,
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (!loadedFile) return;
          if (!state.tabs.includes(loadedFile)) return;
          if (u.docChanged) {
            state.contents.set(loadedFile, u.state.doc.toString());
            scheduleOutline();
          }
          if (u.selectionSet) {
            state.cursors.set(loadedFile, u.state.selection.main.head);
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
    parent: cmHost,
  });

  emitOutline([]);

  view.dom.addEventListener('mouseup', () => {
    if (document.body.style.cursor) document.body.style.cursor = '';
  });

  view.dom.addEventListener('mousemove', (e) => {
    const pos = view!.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos === null) return;
    const line = view!.state.doc.lineAt(pos).number - 1;
    if (line !== hoverLine) { hoverLine = line; setActiveLine(line); }
  });

  setOutlineNavigator((line) => {
    if (!view) return;
    const l = Math.min(line + 1, view.state.doc.lines);
    view.dispatch({ selection: { anchor: view.state.doc.line(l).from }, scrollIntoView: true });
    view.focus();
  });

  subscribe(() => {
    renderTabs();
    if (!view) return;
    if (state.currentFile === loadedFile) return;

    if (loadedFile && state.tabs.includes(loadedFile) && state.contents.has(loadedFile)) {
      state.contents.set(loadedFile, view.state.doc.toString());
      state.cursors.set(loadedFile, view.state.selection.main.head);
    }

    loadedFile = state.currentFile;
    const isPlaceholder = !state.currentFile;
    const isUntitledTab = isUntitled(state.currentFile);
    const kind = isPlaceholder ? 'markdown' : detectKind(state.currentFile!);
    const useCM = isPlaceholder || isUntitledTab || isTextKind(kind);

    if (useCM) {
      cmHost.style.display = '';
      viewerHost.style.display = 'none';

      const editable = !isPlaceholder && !isUntitledTab;
      let content: string;
      if (isPlaceholder) content = PLACEHOLDER;
      else if (isUntitledTab) content = EMPTY_TAB_PLACEHOLDER;
      else content = state.contents.get(state.currentFile!) ?? '';

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        effects: lockComp.reconfigure(
          editable
            ? [EditorView.editable.of(true), EditorState.readOnly.of(false)]
            : [EditorView.editable.of(false), EditorState.readOnly.of(true)],
        ),
      });

      const cursor = editable ? (state.cursors.get(state.currentFile!) ?? 0) : 0;
      view.dispatch({ selection: { anchor: cursor }, scrollIntoView: true });

      emitOutline(parseHeadings(content));
    } else {
      cmHost.style.display = 'none';
      viewerHost.style.display = '';
      void renderViewer(viewerHost, state.currentFile!, kind);
      emitOutline([]);
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
      if (isUntitled(state.currentFile)) { await openFile(explorerPath); return; }
      const name = explorerPath.split('/').pop()?.replace(/\.[^.]+$/, '') || explorerPath;
      const insert = `f"${name}"_"${explorerPath}"`;
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
        const insert = `\nf"${name}"_"${rel}"\n`;
        view.dispatch({
          changes: { from: insertAt, to: insertAt, insert },
          selection: { anchor: insertAt + insert.length },
        });
        insertAt += insert.length;
      } catch (err) { console.error('Import failed', err); }
    }
    await refreshTree();
  });
}
