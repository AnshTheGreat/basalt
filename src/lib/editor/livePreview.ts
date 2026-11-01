import { EditorState, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { applyInline, Push, MATH_RE_EXPORT } from './inlineRules';
import { BulletWidget, CheckboxWidget, DividerWidget, MathPreviewWidget } from '../widgets/inlineWidgets';
import { CodeWidget } from '../widgets/codeWidget';
import { CanvasWidget } from '../widgets/canvasWidget';
import { TableWidget } from '../widgets/tableWidget';

const CODE_RE = /(?<![A-Za-z0-9_])code'([^'_]+)'_'((?:[^'\\]|\\.)*)'/g;
const CANVAS_RE = /\{canvas:([^}]+)\}/g;
const COLOR_MARKER_RE = /\{([rgbymc])\}|\{\/\}/g;

type Decos = ReturnType<Decoration['range']>[];

interface CodeRange { from: number; to: number; lang: string; code: string; }
interface TableRange { from: number; to: number; rows: string[][]; }
interface ColorSpan { from: number; to: number; color: string; }
interface Range { from: number; to: number; }

interface BuiltLine {
  decos: Decos;
  colorMarkers: Range[];
}

interface FieldState {
  byLine: Decos[];
  cursorLine: number;
  codes: CodeRange[];
  tables: TableRange[];
  colorSpans: ColorSpan[];
  colorMarkers: Range[];
  set: DecorationSet;
}

function findCodes(doc: string): CodeRange[] {
  const out: CodeRange[] = [];
  for (const m of doc.matchAll(CODE_RE)) {
    out.push({
      from: m.index!,
      to: m.index! + m[0].length,
      lang: m[1],
      code: m[2].replace(/\\(.)/g, '$1'),
    });
  }
  return out;
}

function findTableRanges(doc: string): TableRange[] {
  const lines = doc.split('\n');
  const offsets: number[] = [];
  let o = 0;
  for (const l of lines) { offsets.push(o); o += l.length + 1; }

  const out: TableRange[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    const sep = i + 1 < lines.length ? lines[i + 1] : '';
    const hasPipe = header.includes('|');
    const isSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(sep) && sep.includes('-');
    if (!hasPipe || !isSep) { i++; continue; }

    let j = i + 2;
    while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '') j++;

    const rows: string[][] = [];
    for (let k = i; k < j; k++) {
      if (k === i + 1) continue;
      const trimmed = lines[k].trim().replace(/^\|/, '').replace(/\|$/, '');
      rows.push(trimmed.split('|').map((c) => c.trim()));
    }

    out.push({
      from: offsets[i],
      to: offsets[j - 1] + lines[j - 1].length,
      rows,
    });
    i = j;
  }
  return out;
}

function findColorSpans(doc: string): ColorSpan[] {
  const spans: ColorSpan[] = [];
  let open: { from: number; color: string } | null = null;
  for (const m of doc.matchAll(COLOR_MARKER_RE)) {
    if (m[1]) {
      if (open) spans.push({ from: open.from, to: m.index!, color: open.color });
      open = { from: m.index! + m[0].length, color: m[1] };
    } else {
      if (open) { spans.push({ from: open.from, to: m.index!, color: open.color }); open = null; }
    }
  }
  if (open) spans.push({ from: open.from, to: doc.length, color: open.color });
  return spans;
}

function applyMandatory(
  text: string,
  lineStart: number,
  push: Push,
  colors: ColorSpan[],
): Range[] {
  const markers: Range[] = [];
  const lineEnd = lineStart + text.length;

  for (const c of colors) {
    if (c.to <= lineStart || c.from >= lineEnd) continue;
    const mf = Math.max(c.from, lineStart);
    const mt = Math.min(c.to, lineEnd);
    if (mf < mt) push(mf, mt, Decoration.mark({ class: `cm-color-${c.color}` }));
  }

  for (const m of text.matchAll(COLOR_MARKER_RE)) {
    const s = lineStart + m.index!;
    const e = s + m[0].length;
    push(s, e, Decoration.replace({}));
    markers.push({ from: s, to: e });
  }

  for (const m of text.matchAll(CANVAS_RE)) {
    const s = lineStart + m.index!;
    push(s, s + m[0].length, Decoration.replace({ widget: new CanvasWidget(m[1]) }));
  }

  return markers;
}

function applyFormatting(text: string, lineStart: number, push: Push) {
  if (/^\s*-{3,}\s*$/.test(text)) {
    push(lineStart, lineStart + text.length, Decoration.replace({ widget: new DividerWidget() }));
    return;
  }

  const h = text.match(/^(#{1,10})\s+(.*)$/);
  if (h) {
    const prefixLen = h[1].length + 1;
    push(lineStart, lineStart, Decoration.line({ class: `cm-heading cm-h${h[1].length}` }));
    push(lineStart, lineStart + prefixLen, Decoration.replace({}));
    applyInline(h[2], lineStart + prefixLen, push);
    return;
  }

  const t = text.match(/^-\[([ xX]?)\]\s*(.*)$/);
  if (t) {
    const checked = t[1] === 'x' || t[1] === 'X';
    const closeIdx = text.indexOf(']');
    const prefixLen = t[0].length - t[2].length;
    const contentStart = lineStart + prefixLen;
    push(lineStart, lineStart, Decoration.line({ class: 'cm-task-line' }));
    push(lineStart, contentStart, Decoration.replace({
      widget: new CheckboxWidget(checked, lineStart + 1, lineStart + closeIdx + 1),
    }));
    applyInline(t[2], contentStart, push);
    return;
  }

  const bSpace = text.match(/^(-+)\s+(.*)$/);
  const bNoSpace = text.match(/^(-{2,})([^\s-].*)$/);
  if (bSpace || bNoSpace) {
    const match = (bSpace ?? bNoSpace)!;
    const hyphens = match[1].length;
    const content = match[2];
    const prefixLen = match[0].length - content.length;
    const level = Math.min(hyphens, 10);
    push(lineStart, lineStart, Decoration.line({ class: `cm-bullet-line cm-bullet-${level}` }));
    push(lineStart, lineStart + prefixLen, Decoration.replace({ widget: new BulletWidget(level) }));
    applyInline(content, lineStart + prefixLen, push);
    return;
  }

  applyInline(text, lineStart, push);
}

function buildLine(
  text: string,
  lineStart: number,
  isCursor: boolean,
  inCode: boolean,
  inTable: boolean,
  colors: ColorSpan[],
): BuiltLine {
  if (inTable) return { decos: [], colorMarkers: [] };

  const decos: Decos = [];
  const push: Push = (from, to, d) => decos.push(d.range(from, to));

  const colorMarkers = applyMandatory(text, lineStart, push, colors);

  if (!isCursor && !inCode) {
    applyFormatting(text, lineStart, push);
  }

  return { decos, colorMarkers };
}

function buildAll(state: EditorState): {
  byLine: Decos[];
  cursorLine: number;
  codes: CodeRange[];
  tables: TableRange[];
  colorSpans: ColorSpan[];
  colorMarkers: Range[];
} {
  const doc = state.doc;
  const docStr = doc.toString();
  const codes = findCodes(docStr);
  const tables = findTableRanges(docStr);
  const colors = findColorSpans(docStr);
  const cursorLine = doc.lineAt(state.selection.main.head).number - 1;
  const byLine: Decos[] = new Array(doc.lines);
  const allMarkers: Range[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const inCode = codes.some((c) => line.from < c.to && line.to > c.from);
    const inTable = tables.some((t) => line.from >= t.from && line.to <= t.to);
    const isCursor = i - 1 === cursorLine;

    if (isCursor) {
      const mathMatches = [...line.text.matchAll(MATH_RE_EXPORT)];
      const exprs = mathMatches.map((m) => m[1]).filter((x) => x.length > 0);
      const built = buildLine(line.text, line.from, true, inCode, inTable, colors);
      if (exprs.length > 0) {
        built.decos.push(
          Decoration.widget({ widget: new MathPreviewWidget(exprs), side: -1, block: true }).range(line.from),
        );
      }
      byLine[i - 1] = built.decos;
      allMarkers.push(...built.colorMarkers);
      continue;
    }

    const built = buildLine(line.text, line.from, false, inCode, inTable, colors);
    byLine[i - 1] = built.decos;
    allMarkers.push(...built.colorMarkers);
  }

  for (const c of codes) {
    const startLineIdx = doc.lineAt(c.from).number - 1;
    byLine[startLineIdx].push(
      Decoration.replace({ widget: new CodeWidget(c.lang, c.code, c.from, c.to) }).range(c.from, c.to),
    );
  }

  for (const t of tables) {
    const startLine = doc.lineAt(t.from);
    const endLine = doc.lineAt(t.to);
    byLine[startLine.number - 1].push(
      Decoration.replace({
        widget: new TableWidget(t.from, t.to, t.rows),
        block: true,
      }).range(startLine.from, endLine.to),
    );
  }

  return { byLine, cursorLine, codes, tables, colorSpans: colors, colorMarkers: allMarkers };
}

function rebuildLine(
  state: EditorState,
  lineIdx: number,
  isCursor: boolean,
  codes: CodeRange[],
  tables: TableRange[],
  colors: ColorSpan[],
): BuiltLine {
  const doc = state.doc;
  if (lineIdx < 0 || lineIdx >= doc.lines) return { decos: [], colorMarkers: [] };
  const line = doc.line(lineIdx + 1);
  const inCode = codes.some((c) => line.from < c.to && line.to > c.from);
  const inTable = tables.some((t) => line.from >= t.from && line.to <= t.to);
  return buildLine(line.text, line.from, isCursor, inCode, inTable, colors);
}

function flatten(byLine: Decos[]): DecorationSet {
  const flat: Decos = [];
  for (const arr of byLine) for (const d of arr) flat.push(d);
  return Decoration.set(flat, true);
}

export const livePreviewField = StateField.define<FieldState>({
  create(state) {
    const built = buildAll(state);
    return {
      byLine: built.byLine,
      cursorLine: built.cursorLine,
      codes: built.codes,
      tables: built.tables,
      colorSpans: built.colorSpans,
      colorMarkers: built.colorMarkers,
      set: flatten(built.byLine),
    };
  },

  update(prev, tr) {
    // Any edit → full rebuild (cheap because this only runs on doc change)
    if (tr.docChanged) {
      const built = buildAll(tr.state);
      return {
        byLine: built.byLine,
        cursorLine: built.cursorLine,
        codes: built.codes,
        tables: built.tables,
        colorSpans: built.colorSpans,
        colorMarkers: built.colorMarkers,
        set: flatten(built.byLine),
      };
    }

    // Cursor-only move → rebuild just the two affected lines.
    // No rescanning the document, no re-matching regexes across the whole file.
    if (tr.selection) {
      const newCursorLine = tr.state.doc.lineAt(tr.state.selection.main.head).number - 1;
      if (newCursorLine === prev.cursorLine) return prev;

      const byLine = prev.byLine.slice();

      const oldBuilt = rebuildLine(
        tr.state, prev.cursorLine, false, prev.codes, prev.tables, prev.colorSpans,
      );
      byLine[prev.cursorLine] = oldBuilt.decos;

      const newBuilt = rebuildLine(
        tr.state, newCursorLine, true, prev.codes, prev.tables, prev.colorSpans,
      );
      byLine[newCursorLine] = newBuilt.decos;

      // Recompute color-marker list because the two rebuilt lines may
      // have added/removed markers. Full scan only of colour markers, not
      // the whole document.
      const colorMarkers = findColorSpans(tr.state.doc.toString())
        .flatMap((span) => {
          const fromLine = tr.state.doc.lineAt(span.from).number;
          const toLine = tr.state.doc.lineAt(span.to).number;
          const out: Range[] = [];
          for (let l = fromLine; l <= toLine; l++) {
            const line = tr.state.doc.line(l);
            const text = line.text;
            for (const m of text.matchAll(COLOR_MARKER_RE)) {
              const s = line.from + m.index!;
              out.push({ from: s, to: s + m[0].length });
            }
          }
          return out;
        });

      return {
        byLine,
        cursorLine: newCursorLine,
        codes: prev.codes,
        tables: prev.tables,
        colorSpans: prev.colorSpans,
        colorMarkers,
        set: flatten(byLine),
      };
    }
    return prev;
  },

  provide: (f) => EditorView.decorations.from(f, (v) => v.set),
});

export const atomicColorField = StateField.define<DecorationSet>({
  create(state) {
    const { colorMarkers } = buildAll(state);
    return Decoration.set(
      colorMarkers.map((r) => Decoration.replace({}).range(r.from, r.to)),
      true,
    );
  },
  update(prev, tr) {
    if (tr.docChanged || tr.selection) {
      const { colorMarkers } = buildAll(tr.state);
      return Decoration.set(
        colorMarkers.map((r) => Decoration.replace({}).range(r.from, r.to)),
        true,
      );
    }
    return prev;
  },
  provide: (f) => EditorView.atomicRanges.of((view) => view.state.field(f)),
});
