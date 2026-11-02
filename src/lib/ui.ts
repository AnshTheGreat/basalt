export function showInlineDialog(
  title: string,
  defaultValue = '',
  placeholder = '',
  selectionEnd?: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'inline-dialog-overlay';
    overlay.innerHTML = `
      <div class="inline-dialog">
        <label></label>
        <input type="text" />
        <div class="inline-dialog-actions">
          <button data-act="cancel">Cancel</button>
          <button data-act="ok">OK</button>
        </div>
      </div>
    `;
    (overlay.querySelector('label') as HTMLElement).textContent = title;
    const input = overlay.querySelector('input') as HTMLInputElement;
    input.placeholder = placeholder;
    input.value = defaultValue;
    document.body.appendChild(overlay);
    input.focus();
    if (selectionEnd !== undefined) {
      input.setSelectionRange(0, selectionEnd);
    } else {
      input.select();
    }

    const close = (v: string | null) => { overlay.remove(); resolve(v); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim() || null);
      if (e.key === 'Escape') close(null);
    });
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => close(input.value.trim() || null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
  });
}

export function confirmDialog(title: string, okLabel = 'OK'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'inline-dialog-overlay';
    overlay.innerHTML = `
      <div class="inline-dialog">
        <label></label>
        <div class="inline-dialog-actions">
          <button data-act="cancel">Cancel</button>
          <button data-act="ok"></button>
        </div>
      </div>
    `;
    (overlay.querySelector('label') as HTMLElement).textContent = title;
    (overlay.querySelector('[data-act="ok"]') as HTMLElement).textContent = okLabel;
    document.body.appendChild(overlay);

    const close = (v: boolean) => { overlay.remove(); resolve(v); };
    overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', () => close(false));
    overlay.querySelector('[data-act="ok"]')!.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    });
    (overlay.querySelector('[data-act="ok"]') as HTMLElement).focus();
  });
}

/**
 * Context menu. Also installs a one-shot `context-menu:toggle` listener that
 * closes the menu if it exists — so Insert / 0 can toggle cleanly.
 */
export function showContextMenu(
  x: number,
  y: number,
  items: { label: string; action: () => void }[],
): HTMLElement {
  // Close any menu that's already open first.
  document.querySelectorAll('.context-menu').forEach((el) => el.remove());

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'context-menu-item';
    el.textContent = item.label;
    el.addEventListener('click', () => { menu.remove(); item.action(); });
    menu.appendChild(el);
  }
  document.body.appendChild(menu);

  const close = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('mousedown', close, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close, true), 0);
  return menu;
}
