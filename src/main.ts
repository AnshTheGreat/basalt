import 'golden-layout/dist/css/goldenlayout-base.css';
import 'golden-layout/dist/css/themes/goldenlayout-dark-theme.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import './styles/base.css';
import './styles/panes.css';
import './styles/overlays.css';
import './editor/core.css';
import './editor/widgets.css';
import './editor/tabs.css';
import './editor/autocomplete.css';
import { initLayout } from './lib/layout/goldenLayout';
import { installShortcuts } from './lib/shortcuts';

document.addEventListener('DOMContentLoaded', async () => {
  installShortcuts();
  await initLayout();
});
