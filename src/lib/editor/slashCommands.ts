import { EditorView } from '@codemirror/view';
import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';

const TABLE_TEMPLATE = `| Column 1 | Column 2 |\n|----------|----------|\n| Cell     | Cell     |`;

const COLOR_NAMES: Record<string, string> = {
  red: 'r', green: 'g', blue: 'b', yellow: 'y', cyan: 'c', magenta: 'm',
};

interface SlashDef { label: string; detail: string; }

const SLASH_COMMANDS: SlashDef[] = [
  { label: '//table', detail: 'Insert a 3-row markdown table template.' },
  { label: '//date', detail: "Insert today's date in DD-MM-YYYY." },
  { label: '//time', detail: 'Insert the current time in HH:MM:SS AM/PM.' },
  { label: '//canvas', detail: 'Insert a drawing canvas saved to attachments/.' },
  { label: '//color-red', detail: 'Start red text.' },
  { label: '//color-green', detail: 'Start green text.' },
  { label: '//color-blue', detail: 'Start blue text.' },
  { label: '//color-yellow', detail: 'Start yellow text.' },
  { label: '//color-cyan', detail: 'Start cyan text.' },
  { label: '//color-magenta', detail: 'Start magenta text.' },
  { label: '//color-white', detail: 'Reset text color to white (default).' },
  { label: '//color-reset', detail: 'Alias for //color-white.' },
];

export function slashCommandCompletions(
  context: CompletionContext,
): CompletionResult | null {
  const word = context.matchBefore(/\/\/[\w-]*/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;
  return {
    from: word.from,
    options: SLASH_COMMANDS.map((c) => ({
      label: c.label,
      info: c.detail,
      apply: c.label + ' ',
    })),
  };
}

export function handleSlashSpace(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const pos = sel.head;
  const line = state.doc.lineAt(pos);
  const before = line.text.slice(0, pos - line.from);
  const m = before.match(/\/\/([\w-]+)$/);
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

  if (cmd === 'color-white' || cmd === 'color-reset') {
    view.dispatch({
      changes: { from: cmdStart, to: pos, insert: '{/}' },
      selection: { anchor: cmdStart + 3 },
    });
    return true;
  }

  const colorMatch = cmd.match(/^color-(\w+)$/);
  if (colorMatch) {
    const marker = COLOR_NAMES[colorMatch[1]];
    if (marker) {
      const insert = `{${marker}}`;
      view.dispatch({
        changes: { from: cmdStart, to: pos, insert },
        selection: { anchor: cmdStart + insert.length },
      });
      return true;
    }
  }

  return false;
}
