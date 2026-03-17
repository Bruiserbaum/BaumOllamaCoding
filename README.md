# BaumOllamaCoding

A dark-themed local Ollama chat interface with streaming responses, multi-model support, and thought process visualization.

## Features

- **Streaming Chat** — Real-time streaming from Ollama `/api/chat` with AbortController stop support
- **Thought Process Visualization** — Parses `<think>...</think>` tags during streaming and displays them in a collapsible, green-tinted panel (ideal for reasoning models like DeepSeek R1, QwQ)
- **Model Selection** — Fetches available models from `/api/tags` and lets you switch mid-session
- **Chat History** — Sessions stored in `localStorage` with auto-titling from first message, create/delete sessions
- **Settings Panel** — Server URL, performance presets, temperature, max tokens, keep_alive, system prompt
- **Export** — Download any session as JSON or Markdown
- **Markdown Rendering** — Full GFM markdown with syntax highlighting (Dracula theme via highlight.js)
- **Copy Code Buttons** — Every code block has a one-click copy button
- **Web Search** — Coming Soon badge in UI (placeholder for future integration)
- **Fully Responsive** — Works on desktop and mobile

## Performance Modes

| Mode | Temperature | Max Tokens | Keep Alive |
|------|-------------|------------|------------|
| Fast | 0.1 | 512 | 5 min |
| Balanced | 0.7 | 2,048 | 30 min |
| Quality | 0.8 | 4,096 | 60 min |

You can also override individual parameters (temperature, max tokens, keep alive) independently.

## Setup

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Ollama](https://ollama.ai/) running locally

### Development

```bash
git clone https://github.com/Bruiserbaum/BaumOllamaCoding.git
cd BaumOllamaCoding
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run preview
```

### Docker

```bash
docker build -t baumollamacoding .
docker run -p 8080:80 baumollamacoding
```

Open [http://localhost:8080](http://localhost:8080).

## Ollama Configuration

BaumOllamaCoding connects to Ollama on `http://localhost:11434` by default.

If running inside Docker or on a different host, update the **Server URL** in Settings.

### CORS — Required for Docker/Remote setups

Ollama must allow requests from your frontend's origin. Set the `OLLAMA_ORIGINS` environment variable:

```bash
# Allow all origins (development)
OLLAMA_ORIGINS=* ollama serve

# Allow specific origin
OLLAMA_ORIGINS=http://localhost:8080 ollama serve
```

On Windows, set it in System Environment Variables and restart Ollama.

### Recommended Models

```bash
# General purpose
ollama pull llama3.2
ollama pull mistral

# Coding
ollama pull codellama
ollama pull deepseek-coder-v2

# Reasoning (thought process visualization)
ollama pull deepseek-r1
ollama pull qwq
```

Reasoning models that emit `<think>...</think>` blocks will automatically display a collapsible "Thought Process" panel above their response.

## Thought Process Feature

Models like DeepSeek R1 and QwQ emit their internal reasoning inside `<think>...</think>` XML tags. BaumOllamaCoding:

1. Detects these tags during the streaming response
2. Routes thought content to a separate accumulator in real-time
3. Displays a collapsible "Thought Process" panel (auto-expanded while thinking, with animated dots)
4. Shows the clean response below the thought panel after `</think>` is closed

## Docker Compose — BaumDocker ai-stack Integration

Add to your `docker-compose.yml`:

```yaml
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_ORIGINS=http://baumollamacoding:80
    restart: unless-stopped

  baumollamacoding:
    build: ./BaumOllamaCoding
    ports:
      - "3010:80"
    depends_on:
      - ollama
    restart: unless-stopped

volumes:
  ollama_data:
```

Then set the Server URL in Settings to `http://ollama:11434`.

## Project Structure

```
src/
  components/
    Header.jsx          — Model selector, web search button, settings toggle
    ChatWindow.jsx      — Scrollable message list, empty state
    MessageBubble.jsx   — User/assistant bubbles with thought process
    ChatInput.jsx       — Auto-resize textarea, send/stop button
    SettingsPanel.jsx   — Slide-in settings drawer
    HistorySidebar.jsx  — Session list with new/delete
  hooks/
    useOllama.js        — Streaming fetch hook with think-tag state machine
  utils/
    storage.js          — localStorage helpers + performance presets
    markdown.js         — marked + highlight.js renderer with copy buttons
  styles/
    app.css             — Complete dark theme CSS
```

## License

Copyright 2025 Bruiserbaum

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Project Status

Active development. Contributions welcome.
