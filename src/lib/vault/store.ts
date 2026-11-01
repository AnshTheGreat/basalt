export interface FileNode {
  name: string; path: string; isDir: boolean; children?: FileNode[];
}

type Listener = () => void;

export const state = {
  vaultPath: null as string | null,
  tree: [] as FileNode[],
  currentFile: null as string | null,
  currentContent: '',
};

const listeners: Listener[] = [];
export function subscribe(fn: Listener) { listeners.push(fn); }
export function notify() { listeners.forEach((f) => f()); }

export async function loadVault(): Promise<boolean> {
  const v = await window.vaultAPI.getVault();
  if (!v) return false;
  state.vaultPath = v;
  state.tree = await window.vaultAPI.listFiles();
  notify();
  return true;
}

export async function openFile(rel: string) {
  const content = await window.vaultAPI.readFile(rel);
  state.currentFile = rel;
  state.currentContent = content;
  notify();
}

export async function saveFile(content: string) {
  if (!state.currentFile) return;
  await window.vaultAPI.writeFile(state.currentFile, content);
  state.currentContent = content;
}

export async function createFile(rel: string) {
  await window.vaultAPI.createFile(rel);
  state.tree = await window.vaultAPI.listFiles();
  notify();
}

export async function refreshTree() {
  state.tree = await window.vaultAPI.listFiles();
  notify();
}
