// src/lib/editor/inlineRules.ts
import { Decoration } from '@codemirror/view';
import { CommentWidget, LatexWidget, LinkWidget, PinWidget } from '../widgets/inlineWidgets';
import { EmbedWidget, embedKind } from '../widgets/embedWidget';

export type Push = (from: number, to: number, deco: Decoration) => void;

const FLAGS_RE = /(?<![A-Za-z0-9_])([biush]+)'((?:[^'\\\n]|\\.)*)'/g;
const STRIKE_RE = /(?<![A-Za-z0-9_])-'((?:[^'\\\n]|\\.)*)'/g;
const MATH_RE = /\$'([^'\n]*)'/g;
const LINK_RE = /(?<![A-Za-z0-9_])l'([^']*)'_'([^']*)'/g;
const EMBED_RE = /(?<![A-Za-z0-9_])f'([^']*)'_'([^']*)'(?:_'([^']*)')?/g;
const COMMENT_RE = /(?<![A-Za-z0-9_])c'([^'\n]*)'/g;
const SUPER_RE = /\^'([^'\n]*)'/g;
const SUB_RE = /~'([^'\n]*)'/g;
const PIN_RE = /(?<![A-Za-z0-9_])p'([^'\n]*)'/g;

const unescape = (s: string) => s.replace(/\\(.)/g, '$1');

const FLAG_CLASS: Record<string, string> = {
  b: 'cm-bold', i: 'cm-italic', u: 'cm-underline', s: 'cm-strike', h: 'cm-highlight',
};

export function applyInline(line: string, lineStart: number, push: Push) {
  for (const m of line.matchAll(FLAGS_RE)) {
    const flags = m[1];
    const openStart = lineStart + m.index!;
    const openEnd = openStart + flags.length + 1;
    const closeStart = openEnd + m[2].length;
    const closeEnd = closeStart + 1;
    push(openStart, openEnd, Decoration.replace({}));
    push(closeStart, closeEnd, Decoration.replace({}));
    if (closeStart > openEnd) {
      const classes = [...flags].map((f) => FLAG_CLASS[f]).filter(Boolean).join(' ');
      push(openEnd, closeStart, Decoration.mark({ class: classes }));
    }
  }
  for (const m of line.matchAll(STRIKE_RE)) {
    const openStart = lineStart + m.index!;
    const openEnd = openStart + 2;
    const closeStart = openEnd + m[1].length;
    const closeEnd = closeStart + 1;
    push(openStart, openEnd, Decoration.replace({}));
    push(closeStart, closeEnd, Decoration.replace({}));
    if (closeStart > openEnd) push(openEnd, closeStart, Decoration.mark({ class: 'cm-strike' }));
  }
  for (const m of line.matchAll(MATH_RE)) {
    const s = lineStart + m.index!;
    push(s, s + m[0].length, Decoration.replace({ widget: new LatexWidget(m[1]) }));
  }
  for (const m of line.matchAll(LINK_RE)) {
    const s = lineStart + m.index!;
    push(s, s + m[0].length, Decoration.replace({ widget: new LinkWidget(m[1], m[2]) }));
  }
  for (const m of line.matchAll(EMBED_RE)) {
    const s = lineStart + m.index!;
    const e = s + m[0].length;
    push(s, e, Decoration.replace({
      widget: new EmbedWidget(m[1], m[2], embedKind(m[2]), s, e, m[3]),
    }));
  }
  for (const m of line.matchAll(COMMENT_RE)) {
    const s = lineStart + m.index!;
    push(s, s + m[0].length, Decoration.replace({ widget: new CommentWidget() }));
  }
  for (const m of line.matchAll(SUPER_RE)) {
    const s = lineStart + m.index!;
    const openEnd = s + 2;
    const closeStart = openEnd + m[1].length;
    const closeEnd = closeStart + 1;
    push(s, openEnd, Decoration.replace({}));
    push(closeStart, closeEnd, Decoration.replace({}));
    if (closeStart > openEnd) push(openEnd, closeStart, Decoration.mark({ class: 'cm-sup' }));
  }
  for (const m of line.matchAll(SUB_RE)) {
    const s = lineStart + m.index!;
    const openEnd = s + 2;
    const closeStart = openEnd + m[1].length;
    const closeEnd = closeStart + 1;
    push(s, openEnd, Decoration.replace({}));
    push(closeStart, closeEnd, Decoration.replace({}));
    if (closeStart > openEnd) push(openEnd, closeStart, Decoration.mark({ class: 'cm-sub' }));
  }
  for (const m of line.matchAll(PIN_RE)) {
    const s = lineStart + m.index!;
    push(s, s + m[0].length, Decoration.replace({ widget: new PinWidget(m[1]) }));
  }
}

export const MATH_RE_EXPORT = MATH_RE;
export const EMBED_RE_EXPORT = EMBED_RE;
