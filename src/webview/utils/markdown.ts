import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

// Configure marked with syntax highlighting
const renderer = new Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  let highlighted: string;
  try {
    highlighted = hljs.highlight(text, { language }).value;
  } catch {
    highlighted = hljs.highlightAuto(text).value;
  }

  // Escape for use in data attribute
  const escapedCode = text.replace(/"/g, '&quot;').replace(/\\/g, '\\\\');

  return `<div class="code-block">
  <div class="code-block-header">
    <span class="code-block-lang">${language}</span>
    <button class="copy-btn" onclick="(function(btn){
      const code = btn.closest('.code-block').querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copy-btn--copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copy-btn--copied'); }, 2000);
      }).catch(() => {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    })(this)">Copy</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
};

marked.use({ renderer });

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    const result = marked.parse(text);
    if (typeof result === 'string') {
      return result;
    }
    return '';
  } catch {
    // Fallback: escape HTML and return as-is
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
