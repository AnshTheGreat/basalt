import { EditorView, WidgetType } from '@codemirror/view';
import { dragState } from '../editor/dragState';

export type EmbedKind = 'image' | 'audio' | 'video' | 'other';

export function embedKind(path: string): EmbedKind {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) return 'video';
  return 'other';
}

function showVideoMenu(x: number, y: number, video: HTMLVideoElement) {
  const existing = document.getElementById('video-ctxmenu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'video-ctxmenu';
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const s of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    const item = document.createElement('div');
    item.className = 'context-menu-item';
    if (video.playbackRate === s) item.classList.add('active');
    item.textContent = `${s}×`;
    item.addEventListener('click', () => {
      video.playbackRate = s;
      menu.remove();
    });
    menu.appendChild(item);
  }

  document.body.appendChild(menu);

  const close = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('mousedown', close, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
}

export class EmbedWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly path: string,
    readonly kind: EmbedKind,
    readonly from: number,
    readonly to: number,
    readonly size: string | undefined,
  ) { super(); }

  eq(o: WidgetType) {
    return o instanceof EmbedWidget && o.path === this.path && o.kind === this.kind &&
      o.from === this.from && o.to === this.to && o.size === this.size;
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-embed';
    wrapper.draggable = true;

    wrapper.addEventListener('dragstart', (e) => {
      dragState.current = { from: this.from, to: this.to, text: view.state.sliceDoc(this.from, this.to) };
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });

    if (this.kind === 'image') {
      const box = document.createElement('span');
      box.className = 'cm-embed-img-box';

      const img = document.createElement('img');
      img.alt = this.name;
      img.draggable = false;
      box.appendChild(img);
      wrapper.appendChild(box);

      const applySize = (w: number, h: number) => {
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
      };

      let parsed: [number, number] | null = null;
      if (this.size) {
        const m = this.size.match(/^(\d+)x(\d+)$/);
        if (m) parsed = [parseInt(m[1], 10), parseInt(m[2], 10)];
      }

      applySize(parsed ? parsed[0] : 300, parsed ? parsed[1] : 200);
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.display = 'block';
      img.style.objectFit = 'contain';

      let lastW = Math.round(parsed ? parsed[0] : 300);
      let lastH = Math.round(parsed ? parsed[1] : 200);
      let debounceTimer: number | null = null;

      const dispatchResize = () => {
        const w = Math.round(box.offsetWidth);
        const h = Math.round(box.offsetHeight);
        if (w <= 0 || h <= 0 || (w === lastW && h === lastH) || !box.isConnected) return;
        lastW = w;
        lastH = h;
        const newText = `f"${this.name}"_"${this.path}"_"${w}x${h}"`;
        try {
          view.dispatch({ changes: { from: this.from, to: this.to, insert: newText } });
        } catch { /* stale */ }
      };

      const ro = new ResizeObserver(() => {
        if (debounceTimer !== null) window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(dispatchResize, 500);
      });
      ro.observe(box);

      window.vaultAPI.readImageAsDataURL(this.path).then((dataUrl) => {
        if (!dataUrl || !dataUrl.startsWith('data:image/')) throw new Error(`Bad data URL`);
        img.src = dataUrl;
      }).catch(() => {
        box.innerHTML = '';
        box.textContent = `⚠ ${this.name}`;
        box.style.width = '220px';
        box.style.height = '60px';
        box.style.display = 'inline-flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
        box.style.color = 'var(--muted)';
      });

      img.onload = () => {
        const nw = img.naturalWidth || 300;
        const nh = img.naturalHeight || 200;
        if (parsed) applySize(parsed[0], parsed[1]);
        else {
          const maxW = 500;
          if (nw > maxW) applySize(maxW, Math.round(nh * (maxW / nw)));
          else applySize(nw, nh);
        }
        lastW = Math.round(box.offsetWidth);
        lastH = Math.round(box.offsetHeight);
      };

      box.addEventListener('mousedown', (e) => e.stopPropagation());
      box.addEventListener('click', (e) => e.stopPropagation());
    } else if (this.kind === 'audio') {
      const box = document.createElement('span');
      box.className = 'cm-embed-audio-box';
      const audio = document.createElement('audio');
      audio.src = `vault:///${this.path}`;
      audio.controls = true;
      box.appendChild(audio);
      wrapper.appendChild(box);
    } else if (this.kind === 'video') {
      const box = document.createElement('span');
      box.className = 'cm-embed-video-box';

      const topBar = document.createElement('span');
      topBar.className = 'cm-embed-video-top';
      topBar.textContent = this.name;
      box.appendChild(topBar);

      const video = document.createElement('video');
      video.src = `vault:///${this.path}`;
      video.className = 'cm-embed-video-el';
      box.appendChild(video);

      const bottomBar = document.createElement('span');
      bottomBar.className = 'cm-embed-video-bottom';
      const progressTrack = document.createElement('span');
      progressTrack.className = 'cm-embed-video-track';
      const progressFill = document.createElement('span');
      progressFill.className = 'cm-embed-video-fill';
      progressTrack.appendChild(progressFill);
      bottomBar.appendChild(progressTrack);
      box.appendChild(bottomBar);

      const updateProgress = () => {
        if (video.duration > 0) {
          progressFill.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }
      };
      video.addEventListener('timeupdate', updateProgress);
      video.addEventListener('loadedmetadata', updateProgress);
      video.addEventListener('ended', () => { progressFill.style.width = '0%'; });

      video.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });

      video.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showVideoMenu(e.clientX, e.clientY, video);
      });

      for (const ev of ['mousedown', 'mouseup', 'click']) {
        box.addEventListener(ev, (e) => e.stopPropagation());
      }

      wrapper.appendChild(box);
    } else {
      const a = document.createElement('a');
      a.className = 'cm-link';
      a.href = `vault:///${this.path}`;
      a.textContent = this.name;
      wrapper.appendChild(a);
    }
    return wrapper;
  }

  ignoreEvent() { return true; }
}
