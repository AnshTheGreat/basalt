import { EditorView } from '@codemirror/view';

export function continueTaskOnEnter(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false;

  const m = line.text.match(/^-\[([ xX]?)\]\s*(.*)$/);
  if (!m) return false;

  if (m[2].trim() === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    });
    return true;
  }
  view.dispatch({
    changes: { from: line.to, to: line.to, insert: '\n-[] ' },
    selection: { anchor: line.to + 5 },
  });
  return true;
}

/**
 * Continues bullet lists on Enter, preserving the exact hyphen count.
 *   "- item"     -> "- "
 *   "-- item"    -> "-- "
 *   "---item"    -> "--- " (no-space source is normalized to space)
 *   "- " (empty) -> exits bullet mode (clears the line)
 */
export function continueBulletOnEnter(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false;

  // Skip task lines — handled above
  if (/^-\[/.test(line.text)) return false;
  // Skip horizontal rules
  if (/^\s*-{3,}\s*$/.test(line.text)) return false;

  // "1+ hyphens" followed by either whitespace+content or (2+ hyphens)+content
  const m = line.text.match(/^(-+)(?:\s+(.*)|([^\s-].*))$/);
  if (!m) return false;

  const hyphens = m[1];
  const content = (m[2] ?? m[3] ?? '');

  if (content.trim() === '') {
    // Empty bullet -> exit bullet mode
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
    });
    return true;
  }

  const insert = '\n' + hyphens + ' ';
  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: { anchor: line.to + insert.length },
  });
  return true;
}

export function handleQuote(view: EditorView): boolean {
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const pos = sel.head;

  if (state.sliceDoc(pos, pos + 1) === "'") {
    view.dispatch({ selection: { anchor: pos + 1 } });
    return true;
  }

  const ctx = state.sliceDoc(Math.max(0, pos - 4), pos);
  const prefixes = ['code', '$', 'b', 'i', 'u', 's', 'h', 'l', 'f', 'c'];
  for (const p of prefixes) {
    if (ctx.endsWith(p)) {
      const before = state.sliceDoc(pos - p.length - 1, pos - p.length);
      if (before === '' || /\s/.test(before) || /[(\[{]/.test(before)) {
        view.dispatch({
          changes: { from: pos, to: pos, insert: "''" },
          selection: { anchor: pos + 1 },
        });
        return true;
      }
    }
  }
  view.dispatch({ changes: { from: pos, to: pos, insert: "'" } });
  return true;
}
