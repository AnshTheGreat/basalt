import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vaultAPI', {
  getVault: () => ipcRenderer.invoke('vault:get'),
  chooseVault: () => ipcRenderer.invoke('vault:choose'),
  createVault: () => ipcRenderer.invoke('vault:create'),
  listFiles: () => ipcRenderer.invoke('vault:list'),
  readFile: (p: string) => ipcRenderer.invoke('vault:read', p),
  writeFile: (p: string, c: string) => ipcRenderer.invoke('vault:write', p, c),
  writeBinary: (p: string, b: ArrayBuffer) => ipcRenderer.invoke('vault:writeBinary', p, b),
  createFile: (p: string) => ipcRenderer.invoke('vault:createFile', p),
  mkdir: (p: string) => ipcRenderer.invoke('vault:mkdir', p),
  rename: (from: string, to: string) => ipcRenderer.invoke('vault:rename', from, to),
  remove: (p: string) => ipcRenderer.invoke('vault:delete', p),
  importFile: (name: string, buffer: ArrayBuffer) => ipcRenderer.invoke('vault:importFile', name, buffer),
  readImageAsDataURL: (p: string) => ipcRenderer.invoke('vault:readImageAsDataURL', p),
  transcode: (input: string, output: string) =>
    ipcRenderer.invoke('ffmpeg:transcode', input, output),
  thumbnail: (input: string, output: string) =>
    ipcRenderer.invoke('ffmpeg:thumbnail', input, output),
});
