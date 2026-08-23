// src/main.js
import React from 'https://esm.sh/react@18';
import ReactDOM from 'https://esm.sh/react-dom@18/client';
import { App } from './App.js';
import { html } from './components/ui.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);
