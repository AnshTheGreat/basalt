import 'golden-layout/dist/css/goldenlayout-base.css';
import 'golden-layout/dist/css/themes/goldenlayout-dark-theme.css';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';
import './styles.css';
import './editor.css';
import { initLayout } from './lib/layout/goldenLayout';

document.addEventListener('DOMContentLoaded', () => { initLayout(); });
