/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
declare module '*.css';

interface FileNode { name: string; path: string; isDir: boolean; children?: FileNode[]; }

interface VaultAPI {
  getVault(): Promise<string | null>;
  chooseVault(): Promise<string | null>;
  createVault(): Promise<string | null>;
  listFiles(): Promise<FileNode[]>;
  readFile(p: string): Promise<string>;
  readBinary(p: string): Promise<ArrayBuffer>;
  writeFile(p: string, c: string): Promise<void>;
  writeBinary(p: string, b: ArrayBuffer): Promise<void>;
  createFile(p: string): Promise<void>;
  mkdir(p: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(p: string): Promise<void>;
  importFile(name: string, buffer: ArrayBuffer): Promise<string>;
  readImageAsDataURL(p: string): Promise<string>;
  transcode(input: string, output: string): Promise<string>;
  thumbnail(input: string, output: string): Promise<string>;
}

interface Window { vaultAPI: VaultAPI; }
