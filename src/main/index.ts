import { app, BrowserWindow, ipcMain, dialog, protocol, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { transcodeToMp4, extractThumbnail } from './ffmpeg';

let currentVaultPath: string | null = null;
const configPath = () => path.join(app.getPath('userData'), 'vault-config.json');

function loadConfig(): { vaultPath: string | null } {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf-8')); }
  catch { return { vaultPath: null }; }
}
function saveConfig(cfg: { vaultPath: string | null }) {
  fs.writeFileSync(configPath(), JSON.stringify(cfg));
}

protocol.registerSchemesAsPrivileged([{
  scheme: 'vault',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

async function walk(dir: string, base: string): Promise<any[]> {
  const out: any[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (e.isDirectory()) {
      out.push({ name: e.name, path: rel, isDir: true, children: await walk(full, base) });
    } else {
      out.push({ name: e.name, path: rel, isDir: false });
    }
  }
  return out;
}

function safeAbs(rel: string): string {
  const root = path.resolve(currentVaultPath!);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('forbidden');
  return abs;
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
};

function setupIpc() {
  ipcMain.handle('vault:get', () => currentVaultPath);
  ipcMain.handle('vault:choose', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    currentVaultPath = r.filePaths[0];
    saveConfig({ vaultPath: currentVaultPath });
    return currentVaultPath;
  });
  ipcMain.handle('vault:create', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    currentVaultPath = r.filePaths[0];
    saveConfig({ vaultPath: currentVaultPath });
    return currentVaultPath;
  });
  ipcMain.handle('vault:list', async () => {
    if (!currentVaultPath) return [];
    try { return await walk(currentVaultPath, currentVaultPath); }
    catch { return []; }
  });
  ipcMain.handle('vault:read', async (_e, rel: string) => {
    if (!currentVaultPath) return '';
    return await fs.promises.readFile(safeAbs(rel), 'utf-8');
  });
  ipcMain.handle('vault:write', async (_e, rel: string, content: string) => {
    if (!currentVaultPath) return;
    const abs = safeAbs(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, 'utf-8');
  });
  ipcMain.handle('vault:writeBinary', async (_e, rel: string, buffer: ArrayBuffer) => {
    if (!currentVaultPath) throw new Error('No vault');
    const abs = safeAbs(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, Buffer.from(new Uint8Array(buffer)));
  });
  ipcMain.handle('vault:createFile', async (_e, rel: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    const abs = safeAbs(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    try { await fs.promises.writeFile(abs, '', { flag: 'wx' }); }
    catch (err: any) { if (err.code === 'EEXIST') return; throw err; }
  });
  ipcMain.handle('vault:mkdir', async (_e, rel: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    await fs.promises.mkdir(safeAbs(rel), { recursive: true });
  });
  ipcMain.handle('vault:rename', async (_e, from: string, to: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    const absFrom = safeAbs(from);
    const absTo = safeAbs(to);
    await fs.promises.mkdir(path.dirname(absTo), { recursive: true });
    await fs.promises.rename(absFrom, absTo);
  });
  ipcMain.handle('vault:delete', async (_e, rel: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    await fs.promises.rm(safeAbs(rel), { recursive: true, force: true });
  });
  ipcMain.handle('vault:importFile', async (_e, name: string, buffer: ArrayBuffer) => {
    if (!currentVaultPath) throw new Error('No vault');
    const buf = Buffer.from(new Uint8Array(buffer));
    const safe = name.replace(/[^\w.\-]/g, '_') || 'file';
    const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const rel = 'attachments/' + stamp + '_' + safe;
    const abs = safeAbs(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, buf);
    return rel;
  });
  ipcMain.handle('vault:readImageAsDataURL', async (_e, rel: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    const abs = safeAbs(rel);
    const buf = await fs.promises.readFile(abs);
    const ext = abs.split('.').pop()?.toLowerCase() || '';
    const mime = MIME[ext] || 'application/octet-stream';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    console.log('[image]', rel, ext, buf.length, dataUrl.slice(0, 40));
    return dataUrl;
  });

  ipcMain.handle('ffmpeg:transcode', async (_e, input: string, output: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    const absIn = safeAbs(input);
    const absOut = safeAbs(output);
    await fs.promises.mkdir(path.dirname(absOut), { recursive: true });
    await transcodeToMp4(absIn, absOut);
    return path.relative(currentVaultPath, absOut).replace(/\\/g, '/');
  });

  ipcMain.handle('ffmpeg:thumbnail', async (_e, input: string, output: string) => {
    if (!currentVaultPath) throw new Error('No vault');
    const absIn = safeAbs(input);
    const absOut = safeAbs(output);
    await fs.promises.mkdir(path.dirname(absOut), { recursive: true });
    await extractThumbnail(absIn, absOut);
    return path.relative(currentVaultPath, absOut).replace(/\\/g, '/');
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, backgroundColor: '#1e1e1e',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(() => {
  // Point mediaforge at bundled ffmpeg/ffprobe if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) process.env.FFMPEG_PATH = ffmpegStatic;
  } catch { /* ffmpeg-static not installed — use system PATH */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeStatic = require('ffprobe-static');
    if (ffprobeStatic?.path) process.env.FFPROBE_PATH = ffprobeStatic.path;
  } catch { /* ffprobe-static not installed — use system PATH */ }

  currentVaultPath = loadConfig().vaultPath;
  setupIpc();

  protocol.handle('vault', async (request) => {
    if (!currentVaultPath) return new Response('No vault', { status: 404 });
    try {
      const url = new URL(request.url);
      const rel = decodeURIComponent(url.pathname).replace(/^\//, '');
      const abs = safeAbs(rel);
      const data = await fs.promises.readFile(abs);
      const ext = abs.split('.').pop()?.toLowerCase() || '';
      return new Response(new Uint8Array(data), {
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
