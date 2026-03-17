import { marked } from 'marked';
import hljs from 'highlight.js';

let copyButtonIdCounter = 0;

const renderer = new marked.Renderer();

renderer.code = function (code, language) {
  const validLang = language && hljs.getLanguage(language) ? language : null;
  let highlighted;
  try {
    highlighted = validLang
      ? hljs.highlight(code, { language: validLang }).value
      : hljs.highlightAuto(code).value;
  } catch {
    highlighted = escapeHtml(code);
  }

  const id = `copy-btn-${++copyButtonIdCounter}`;
  const langLabel = validLang || 'text';

  return `<div class="code-block-wrapper">
    <div class="code-block-header">
      <span class="code-lang">${escapeHtml(langLabel)}</span>
      <button class="copy-code-btn" id="${id}" onclick="(function(btn){
        const pre = btn.closest('.code-block-wrapper').querySelector('code');
        const text = pre ? pre.innerText : '';
        navigator.clipboard.writeText(text).then(function(){
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function(){ btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
        }).catch(function(){
          btn.textContent = 'Failed';
          setTimeout(function(){ btn.textContent = 'Copy'; }, 2000);
        });
      })(this)">Copy</button>
    </div>
    <pre><code class="hljs language-${escapeHtml(langLabel)}">${highlighted}</code></pre>
  </div>`;
};

renderer.codespan = function (code) {
  return `<code class="inline-code">${code}</code>`;
};

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true,
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  try {
    return marked.parse(text);
  } catch (e) {
    console.error('Markdown render error:', e);
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
}
