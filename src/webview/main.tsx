import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';

// Event delegation for copy buttons — avoids inline onclick CSP violations
document.addEventListener('click', (e: MouseEvent) => {
  const btn = (e.target as Element).closest('.copy-btn') as HTMLButtonElement | null;
  if (!btn) { return; }
  const encoded = btn.getAttribute('data-code') ?? '';
  const code = decodeURIComponent(encoded);
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copy-btn--copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copy-btn--copied');
    }, 2000);
  }).catch(() => {
    btn.textContent = 'Failed';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
});

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
