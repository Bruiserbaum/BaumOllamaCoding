import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

const renderer = new Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  let highlighted: string;
  try {
    highlighted = hljs.highlight(text, { language }).value;
  } catch {
    highlighted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return `<div class="code-block">
  <div class="code-block-header">
    <span class="code-block-lang">${language}</span>
    <button class="copy-btn" data-code="${encodeURIComponent(text)}">Copy</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
};

// Single marked.use() call — do not mix with marked.setOptions()
marked.use({
  renderer,
  gfm: true,
  breaks: true,
});

export function renderMarkdown(text: string): string {
  if (!text) { return ''; }
  try {
    // Pass async:false to guarantee a synchronous string return value
    return marked.parse(text, { async: false }) as string;
  } catch {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
