import { EditorView } from '@codemirror/view';

const TABLE_TEMPLATE = `| Column 1 | Column 2 |\n|----------|----------|\n| Cell     | Cell     |`;

const COLOR_MAP: Record<string, string> = {
  red: 'r', green: 'g', blue: 'b', yellow: 'y', cyan: 'c', magenta: 'm',
};

export function handleSlashSpace(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const pos = sel.head;
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  const m = before.match(/\/\/(\w+)$/);
  if (!m) return false;

  const cmd = m[1].toLowerCase();
  const cmdStart = pos - m[0].length;

  if (cmd === 'table') {
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert: TABLE_TEMPLATE },
      selection: { anchor: cmdStart + 2 },
    });
    return true;
  }

  if (cmd === 'date') {
    const d = new Date();
    const str = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert: str },
      selection: { anchor: cmdStart + str.length },
    });
    return true;
  }

  if (cmd === 'time') {
    const d = new Date();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const str = `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${ampm}`;
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert: str },
      selection: { anchor: cmdStart + str.length },
    });
    return true;
  }

  if (cmd === 'canvas') {
    const path = `attachments/canvas_${Date.now()}.png`;
    const insert = `{canvas:${path}}`;
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert },
      selection: { anchor: cmdStart + insert.length },
    });
    return true;
  }

  if (cmd === 'white' || COLOR_MAP[cmd]) {
    const marker = cmd === 'white' ? '{/}' : `{${COLOR_MAP[cmd]}}`;
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert: marker },
      selection: { anchor: cmdStart + marker.length },
    });
    return true;
  }

  return false;
}
