import { ComponentContainer } from 'golden-layout';

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
  type: 'heading' | 'pin';
}

interface TreeNode { item: OutlineItem; children: TreeNode[]; }

let lastOutline: OutlineItem[] = [];
const listeners: Array<(h: OutlineItem[]) => void> = [];
let navigator: ((line: number) => void) | null = null;
let renderedRows: Array<{ el: HTMLElement; line: number }> = [];
let activeLine = -1;

const PIN_RE = /(?<![A-Za-z0-9_])p'([^'\n]*)'/g;
const collapsed = new Set<string>();

export function parseHeadings(doc: string): OutlineItem[] {
  const out: OutlineItem[] = [];
  doc.split('\n').forEach((line, i) => {
    const h = line.match(/^(#{1,10})\s+(.*)$/);
    if (h) out.push({ level: h[1].length, text: h[2], line: i, type: 'heading' });
    for (const m of line.matchAll(PIN_RE)) {
      out.push({ level: 1, text: m[1], line: i, type: 'pin' });
    }
  });
  return out;
}

export function emitOutline(items: OutlineItem[]) {
  lastOutline = items;
  listeners.forEach((fn) => fn(items));
}

export function subscribeOutline(fn: (h: OutlineItem[]) => void) {
  listeners.push(fn);
  fn(lastOutline);
}

export function setOutlineNavigator(fn: (line: number) => void) {
  navigator = fn;
}

export function setActiveLine(line: number) {
  if (line === activeLine) return;
  activeLine = line;

  let bestLine = -1;
  for (const r of renderedRows) {
    if (r.line <= line) bestLine = r.line;
    else break;
  }

  for (const r of renderedRows) {
    if (r.line === bestLine) r.el.classList.add('active');
    else r.el.classList.remove('active');
  }
}

function buildTree(items: OutlineItem[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const item of items) {
    const node: TreeNode = { item, children: [] };
    if (item.type === 'pin') {
      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      continue;
    }
    while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return roots;
}

function renderNode(node: TreeNode): HTMLElement {
  const container = document.createElement('div');
  container.className = 'outline-node';

  const row = document.createElement('div');
  row.className = 'outline-row';
  row.style.paddingLeft = `${(node.item.level - 1) * 12 + 6}px`;
  if (node.item.type === 'pin') row.classList.add('outline-pin');

  const arrow = document.createElement('span');
  arrow.className = 'outline-arrow';
  if (node.children.length > 0) {
    arrow.textContent = collapsed.has(node.item.text) ? '▸' : '▾';
  } else {
    arrow.textContent = '';
    arrow.classList.add('outline-arrow-empty');
  }
  row.appendChild(arrow);

  const label = document.createElement('span');
  label.className = 'outline-label';
  label.textContent = node.item.text;
  row.appendChild(label);

  container.appendChild(row);
  renderedRows.push({ el: row, line: node.item.line });

  if (node.children.length > 0) {
    const childBox = document.createElement('div');
    childBox.className = 'outline-children';
    if (collapsed.has(node.item.text)) childBox.style.display = 'none';
    for (const c of node.children) childBox.appendChild(renderNode(c));
    container.appendChild(childBox);

    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement) === arrow) {
        e.stopPropagation();
        if (collapsed.has(node.item.text)) {
          collapsed.delete(node.item.text);
          childBox.style.display = 'block';
          arrow.textContent = '▾';
        } else {
          collapsed.add(node.item.text);
          childBox.style.display = 'none';
          arrow.textContent = '▸';
        }
      } else {
        navigator?.(node.item.line);
      }
    });
  } else {
    row.addEventListener('click', () => navigator?.(node.item.line));
  }

  return container;
}

export function createOutlinePane(container: ComponentContainer) {
  const div = document.createElement('div');
  div.className = 'outline-pane';
  container.element.appendChild(div);

  subscribeOutline((items) => {
    div.innerHTML = '';
    renderedRows = [];
    if (items.length === 0) {
      div.textContent = 'No headings';
      return;
    }
    const tree = buildTree(items);
    for (const root of tree) div.appendChild(renderNode(root));
    const cur = activeLine;
    activeLine = -1;
    setActiveLine(cur);
  });
}
