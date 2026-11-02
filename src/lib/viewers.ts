export type FileKind =
  | 'markdown' | 'text'
  | 'image' | 'audio' | 'video'
  | 'pdf'
  | 'docx' | 'xlsx'
  | 'zip'
  | 'binary';

const TEXT = new Set([
  'md', 'markdown', 'txt', 'json', 'xml', 'yaml', 'yml', 'toml',
  'csv', 'tsv', 'html', 'htm', 'css', 'js', 'mjs', 'cjs', 'ts',
  'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'hpp', 'sh', 'bash', 'zsh', 'ps1', 'sql', 'log', 'ini', 'cfg',
  'conf', 'env', 'lock', 'gitignore',
]);
const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'wma', 'aiff']);
const VIDEO = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', '3gp', 'ogv']);

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
  ico: 'image/x-icon', tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif',
};
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/opus', wma: 'audio/x-ms-wma',
  aiff: 'audio/aiff',
};
const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  mov: 'video/quicktime', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
  m4v: 'video/mp4', ogv: 'video/ogg',
};

export function detectKind(path: string): FileKind {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (TEXT.has(ext)) return 'text';
  if (IMAGES.has(ext)) return 'image';
  if (AUDIO.has(ext)) return 'audio';
  if (VIDEO.has(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') return 'xlsx';
  if (ext === 'zip' || ext === 'tar' || ext === 'gz' || ext === 'tgz') return 'zip';
  return 'binary';
}

export function isTextKind(kind: FileKind): boolean {
  return kind === 'markdown' || kind === 'text';
}

async function blobUrl(path: string, fallback: string): Promise<string> {
  const buf = await window.vaultAPI.readBinary(path);
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mime = (IMAGE_MIME[AUDIO_MIME[ext] ? '' : ext]) ||
    AUDIO_MIME[ext] || VIDEO_MIME[ext] || fallback;
  return URL.createObjectURL(new Blob([buf], { type: mime }));
}

export async function renderViewer(host: HTMLElement, path: string, kind: FileKind) {
  host.innerHTML = '';
  host.className = `viewer viewer-${kind}`;

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K) =>
    document.createElement(tag);

  if (kind === 'image') {
    const img = make('img');
    img.className = 'viewer-image';
    img.alt = path.split('/').pop() || '';
    host.appendChild(img);
    try {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const mime = IMAGE_MIME[ext] || 'image/png';
      const buf = await window.vaultAPI.readBinary(path);
      img.src = URL.createObjectURL(new Blob([buf], { type: mime }));
    } catch (err) {
      host.textContent = `Failed to load image: ${err}`;
    }
  } else if (kind === 'audio') {
    const audio = make('audio');
    audio.controls = true;
    audio.className = 'viewer-audio';
    host.appendChild(audio);
    try {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      const mime = AUDIO_MIME[ext] || 'audio/mpeg';
      const buf = await window.vaultAPI.readBinary(path);
      audio.src = URL.createObjectURL(new Blob([buf], { type: mime }));
    } catch (err) {
      host.textContent = `Failed to load audio: ${err}`;
    }
  } else if (kind === 'video') {
    const video = make('video');
    video.controls = true;
    video.className = 'viewer-video';
    host.appendChild(video);
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const nativeMime = VIDEO_MIME[ext];
    if (nativeMime && ['mp4', 'webm', 'ogv'].includes(ext)) {
      try {
        const buf = await window.vaultAPI.readBinary(path);
        video.src = URL.createObjectURL(new Blob([buf], { type: nativeMime }));
      } catch (err) {
        host.textContent = `Failed to load video: ${err}`;
      }
    } else {
      // Non-native format — transcode via ffmpeg to mp4
      try {
        const out = `attachments/.transcoded/${Date.now()}.mp4`;
        await window.vaultAPI.transcode(path, out);
        const buf = await window.vaultAPI.readBinary(out);
        video.src = URL.createObjectURL(new Blob([buf], { type: 'video/mp4' }));
      } catch (err) {
        host.textContent = `Failed to load video (transcode failed): ${err}`;
      }
    }
  } else if (kind === 'pdf') {
    try {
      const buf = await window.vaultAPI.readBinary(path);
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
      const embed = make('embed');
      embed.src = url;
      embed.type = 'application/pdf';
      embed.className = 'viewer-pdf';
      host.appendChild(embed);
    } catch (err) {
      host.textContent = `Failed to load PDF: ${err}`;
    }
  } else if (kind === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const buf = await window.vaultAPI.readBinary(path);
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      const div = make('div');
      div.className = 'viewer-docx';
      div.innerHTML = result.value;
      host.appendChild(div);
    } catch (err) {
      host.textContent = `Failed to render docx: ${err}`;
    }
  } else if (kind === 'xlsx') {
    try {
      const XLSX = await import('xlsx');
      const buf = await window.vaultAPI.readBinary(path);
      const wb = XLSX.read(buf, { type: 'array' });
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const html = XLSX.utils.sheet_to_html(sheet);
        const section = make('div');
        section.className = 'viewer-xlsx-sheet';
        const title = make('h3');
        title.textContent = sheetName;
        section.appendChild(title);
        const inner = make('div');
        inner.innerHTML = html;
        section.appendChild(inner);
        host.appendChild(section);
      }
    } catch (err) {
      host.textContent = `Failed to render xlsx: ${err}`;
    }
  } else if (kind === 'zip') {
    try {
      const JSZip = (await import('jszip')).default;
      const buf = await window.vaultAPI.readBinary(path);
      const zip = await JSZip.loadAsync(buf);
      const ul = make('ul');
      ul.className = 'viewer-zip-list';
      zip.forEach((relPath, entry) => {
        const li = make('li');
        li.textContent = (entry.dir ? '📁 ' : '📄 ') + relPath;
        ul.appendChild(li);
      });
      host.appendChild(ul);
    } catch (err) {
      host.textContent = `Failed to render zip: ${err}`;
    }
  } else {
    host.textContent = `No viewer available for: ${path}`;
  }
}
