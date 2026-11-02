import { detectKind, isTextKind } from '../viewers';

export interface FileNode {
  name: string; path: string; isDir: boolean; children?: FileNode[];
}

type Listener = () => void;

const EMPTY_PREFIX = '__empty__/';

export function isUntitled(path: string | null): boolean {
  return !!path && path.startsWith(EMPTY_PREFIX);
}

export const state = {
  vaultPath: null as string | null,
  tree: [] as FileNode[],
  tabs: [] as string[],
  activeTab: null as string | null,
  contents: new Map<string, string>(),
  cursors: new Map<string, number>(),
  editingFile: null as string | null,

  get currentFile(): string | null { return this.activeTab; },
  get currentContent(): string {
    return this.activeTab ? (this.contents.get(this.activeTab) ?? '') : '';
  },
};

const listeners: Listener[] = [];
export function subscribe(fn: Listener) { listeners.push(fn); }
export function notify() { listeners.forEach((f) => f()); }

export function setEditingFile(path: string | null) {
  state.editingFile = path;
  notify();
}

export async function loadVault(): Promise<boolean> {
  const v = await window.vaultAPI.getVault();
  if (!v) return false;
  if (state.vaultPath !== v) {
    state.vaultPath = v;
    state.tabs = [];
    state.activeTab = null;
    state.contents = new Map();
    state.cursors = new Map();
    state.editingFile = null;
  }
  state.tree = await window.vaultAPI.listFiles();
  notify();
  return true;
}

export function newEmptyTab(): string {
  const id = EMPTY_PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  state.tabs.push(id);
  state.contents.set(id, '');
  state.activeTab = id;
  notify();
  return id;
}

async function ensureLoaded(rel: string) {
  if (!isTextKind(detectKind(rel))) return;
  if (state.contents.has(rel)) return;
  const content = await window.vaultAPI.readFile(rel);
  state.contents.set(rel, content);
}

export async function openFile(rel: string) {
  await ensureLoaded(rel);
  const emptyPath = isUntitled(state.activeTab) ? state.activeTab : null;

  if (emptyPath) {
    const idx = state.tabs.indexOf(emptyPath);
    if (state.tabs.includes(rel)) { if (idx >= 0) state.tabs.splice(idx, 1); }
    else if (idx >= 0) state.tabs[idx] = rel;
    state.contents.delete(emptyPath);
    state.cursors.delete(emptyPath);
  } else if (!state.tabs.includes(rel)) {
    state.tabs.push(rel);
  }
  state.activeTab = rel;
  notify();
}

export async function openFileInCurrentTab(rel: string) {
  await ensureLoaded(rel);
  if (state.tabs.includes(rel)) { state.activeTab = rel; notify(); return; }

  if (state.activeTab) {
    const idx = state.tabs.indexOf(state.activeTab);
    if (idx >= 0) {
      const old = state.tabs[idx];
      state.contents.delete(old);
      state.cursors.delete(old);
      state.tabs[idx] = rel;
    }
  } else state.tabs.push(rel);
  state.activeTab = rel;
  notify();
}

/**
 * Save the active file. If the last line contains any content, a trailing
 * newline is appended so you can always press Enter past a block widget
 * (table, code block, etc.). Non-text files are skipped.
 */
export async function saveFile(content?: string) {
  if (!state.currentFile || isUntitled(state.currentFile)) return;
  if (!state.contents.has(state.currentFile)) return;
  const c = content ?? (state.contents.get(state.currentFile) ?? '');
  const lastNewline = c.lastIndexOf('\n');
  const lastLine = lastNewline === -1 ? c : c.slice(lastNewline + 1);
  const toWrite = lastLine.length > 0 ? c + '\n' : c;
  await window.vaultAPI.writeFile(state.currentFile, toWrite);
  state.contents.set(state.currentFile, toWrite);
}

export async function createFile(rel: string) {
  await window.vaultAPI.createFile(rel);
  state.tree = await window.vaultAPI.listFiles();
  notify();
}

export function closeTab(rel: string) {
  const idx = state.tabs.indexOf(rel);
  if (idx < 0) return;
  state.tabs.splice(idx, 1);
  state.contents.delete(rel);
  state.cursors.delete(rel);
  if (state.activeTab === rel) {
    if (state.tabs.length === 0) state.activeTab = null;
    else state.activeTab = state.tabs[Math.min(idx, state.tabs.length - 1)];
  }
  notify();
}

export function switchTab(dir: 1 | -1) {
  if (state.tabs.length < 2) return;
  const cur = state.activeTab;
  const idx = cur ? state.tabs.indexOf(cur) : -1;
  const next = (idx + dir + state.tabs.length) % state.tabs.length;
  state.activeTab = state.tabs[next];
  notify();
}

export async function refreshTree() {
  state.tree = await window.vaultAPI.listFiles();
  notify();
}
