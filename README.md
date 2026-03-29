# BaumOllamaCoding

A VS Code extension for chatting with a local [Ollama](https://ollama.com) server directly in the sidebar — with streaming responses, thought process visualization, multi-model support, persistent chat history, and a fully theme-integrated UI.

## Features

- **Streaming chat** — responses stream token-by-token in real time
- **Thought process visualization** — models that emit `<think>...</think>` blocks (e.g. QwQ, DeepSeek-R1) show a collapsible "Thought Process" panel that auto-expands while thinking and collapses when done
- **Multi-model support** — pick any installed Ollama model from a dropdown; refresh with one click
- **Persistent chat history** — sessions stored in VS Code global state, survive restarts
- **Sidebar + panel mode** — use as a sidebar view or pop out into a full editor panel
- **Markdown rendering** — assistant responses render with syntax-highlighted code blocks and copy buttons
- **Settings panel** — configure server URL, temperature, max tokens, keep-alive, system prompt; test connection inline
- **Performance presets** — Fast / Balanced / Quality one-click presets
- **Export chat** — save any conversation as Markdown via a save dialog
- **VS Code theme integration** — uses VS Code CSS variables throughout; looks native in any theme

## Installation

### From VSIX

1. Download the latest `.vsix` from [Releases](https://github.com/Bruiserbaum/BaumOllamaCoding/releases)
2. In VS Code: `Ctrl+Shift+P` → "Extensions: Install from VSIX..." → select the file
3. The ◈ icon appears in the Activity Bar

### Build from source

```bash
git clone https://github.com/Bruiserbaum/BaumOllamaCoding
cd BaumOllamaCoding
npm install
npm run build
npm run package   # creates baumollamacoding-1.0.0.vsix
# Then in VS Code: Ctrl+Shift+P → "Extensions: Install from VSIX..."
```

## Ollama Setup

1. Install Ollama: https://ollama.com/download
2. Pull a model:
   ```bash
   ollama pull llama3.2          # general purpose
   ollama pull qwq:32b           # reasoning with <think> blocks
   ollama pull deepseek-r1:14b   # another reasoning model
   ollama pull codellama         # coding focused
   ```
3. Ollama runs at `http://localhost:11434` by default — matches the extension default

## Thought Process Visualization

Models like [QwQ](https://ollama.com/library/qwq) and [DeepSeek-R1](https://ollama.com/library/deepseek-r1) wrap their internal reasoning in `<think>...</think>` XML tags before giving a final answer. BaumOllamaCoding detects these tags in the stream and displays them in a separate collapsible "Thought Process" panel (💭) so you can see _why_ the model reached its conclusion without cluttering the main response.

The panel auto-expands while the model is thinking and collapses automatically ~1.5 seconds after the stream ends.

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| `baumollamacoding.serverUrl` | `http://localhost:11434` | Ollama server URL |
| `baumollamacoding.defaultModel` | _(empty)_ | Model selected on startup |
| `baumollamacoding.temperature` | `0.7` | Sampling temperature (0 = deterministic, 1 = creative) |
| `baumollamacoding.maxTokens` | `2048` | Maximum tokens to generate per response |
| `baumollamacoding.keepAlive` | `30m` | How long Ollama keeps the model loaded in memory |

Additional settings (system prompt) are stored in VS Code global state via the Settings panel.

## Performance Modes

| Mode | Temperature | Max Tokens | Best for |
|---|---|---|---|
| Fast | 0.3 | 512 | Quick answers, autocomplete suggestions |
| Balanced | 0.7 | 2048 | General use (default) |
| Quality | 0.9 | 4096 | Creative writing, complex reasoning |

## Commands

| Command | Description |
|---|---|
| `BaumOllamaCoding: Open in Panel` | Opens the chat in an editor panel instead of the sidebar |
| `BaumOllamaCoding: New Chat` | Starts a fresh conversation |

## Architecture Notes

The extension uses VS Code's standard two-context architecture:

- **Extension host** (`src/extension.ts`, `src/ChatProvider.ts`, `src/OllamaService.ts`) — Node.js, makes all Ollama HTTP calls, streams results to webview via `postMessage`
- **Webview** (`src/webview/`) — React 18 app, receives streamed chunks, renders UI

This means Ollama API calls never happen in the browser context, avoiding CORS issues entirely.

## Project Structure

```
src/
  extension.ts          — Activation, registers view provider + commands
  ChatProvider.ts       — WebviewViewProvider, message routing, session/settings storage
  OllamaService.ts      — Ollama HTTP client with streaming + <think> state machine
  webview/
    main.tsx            — React 18 createRoot entry point
    App.tsx             — Root component, state management
    vscode.ts           — acquireVsCodeApi() bridge
    components/
      Header.tsx        — Model selector, toolbar buttons
      ChatWindow.tsx    — Scrollable message list
      MessageBubble.tsx — User/assistant bubbles with thought process panel
      ChatInput.tsx     — Auto-resize textarea, send/stop toggle
      SettingsPanel.tsx — Slide-in settings drawer
      HistorySidebar.tsx — Session list with new/delete
    utils/
      markdown.ts       — marked + highlight.js renderer with copy buttons
    styles/
      app.css           — VS Code variable-based theme
```

## License and Project Status

This repository is a personal project shared publicly for learning, reference, portfolio, and experimentation purposes.

Development may include AI-assisted ideation, drafting, refactoring, or code generation. All code and content published here were reviewed, selected, and curated before release.

This project is licensed under the Apache License 2.0. See the LICENSE file for details.

Unless explicitly stated otherwise, this repository is provided as-is, without warranty, support obligation, or guarantee of suitability for production use.

Any third-party libraries, assets, icons, fonts, models, or dependencies used by this project remain subject to their own licenses and terms.
