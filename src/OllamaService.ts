export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
  keep_alive?: string;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onThoughtChunk: (content: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

// State machine for <think> tag parsing
const enum ThinkState {
  Normal,
  InThink,
  AfterThink,
}

export class OllamaService {
  async getModels(serverUrl: string): Promise<string[]> {
    const url = `${serverUrl.replace(/\/$/, '')}/api/tags`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name).sort();
  }

  async streamChat(
    serverUrl: string,
    model: string,
    messages: OllamaMessage[],
    options: OllamaOptions,
    signal: AbortSignal,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const url = `${serverUrl.replace(/\/$/, '')}/api/chat`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature,
            num_predict: options.num_predict,
          },
          keep_alive: options.keep_alive ?? '30m',
        }),
        signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        callbacks.onDone();
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    if (!response.ok) {
      callbacks.onError(new Error(`Ollama API error: ${response.status} ${response.statusText}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError(new Error('No response body'));
      return;
    }

    const decoder = new TextDecoder();
    let lineBuffer = '';

    // Think state machine state
    let thinkState = ThinkState.Normal;
    // Buffer for partial tag detection
    let tagBuffer = '';

    const processText = (text: string) => {
      // We need to handle <think> and </think> tags potentially split across chunks.
      // Strategy: process character-by-character through a combined buffer.
      let i = 0;
      while (i < text.length) {
        const char = text[i];

        if (thinkState === ThinkState.Normal) {
          // Look for start of <think>
          tagBuffer += char;
          if ('<think>'.startsWith(tagBuffer)) {
            if (tagBuffer === '<think>') {
              thinkState = ThinkState.InThink;
              tagBuffer = '';
            }
            // else: partial match, keep buffering
          } else {
            // Not a tag match — flush tagBuffer as normal content
            const toFlush = tagBuffer;
            tagBuffer = '';
            callbacks.onChunk(toFlush);
            // Don't increment i since we already consumed char via tagBuffer append
          }
        } else if (thinkState === ThinkState.InThink) {
          // Look for </think>
          tagBuffer += char;
          if ('</think>'.startsWith(tagBuffer)) {
            if (tagBuffer === '</think>') {
              thinkState = ThinkState.AfterThink;
              tagBuffer = '';
            }
            // else: partial match, keep buffering
          } else {
            // Not the close tag — flush tagBuffer as thought content
            const toFlush = tagBuffer;
            tagBuffer = '';
            callbacks.onThoughtChunk(toFlush);
          }
        } else {
          // AfterThink — normal content again (no more think tags expected)
          callbacks.onChunk(char);
        }

        i++;
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: { message?: { content?: string }; done?: boolean };
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (parsed.message?.content) {
            processText(parsed.message.content);
          }

          if (parsed.done === true) {
            // Flush any remaining tagBuffer
            if (tagBuffer) {
              if (thinkState === ThinkState.InThink) {
                callbacks.onThoughtChunk(tagBuffer);
              } else {
                callbacks.onChunk(tagBuffer);
              }
              tagBuffer = '';
            }
            callbacks.onDone();
            return;
          }
        }
      }

      // Stream ended without done flag
      if (tagBuffer) {
        if (thinkState === ThinkState.InThink) {
          callbacks.onThoughtChunk(tagBuffer);
        } else {
          callbacks.onChunk(tagBuffer);
        }
        tagBuffer = '';
      }
      callbacks.onDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        callbacks.onDone();
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      reader.releaseLock();
    }
  }
}
