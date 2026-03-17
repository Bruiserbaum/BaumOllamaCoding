import { useRef, useState, useCallback } from 'react';

export function useOllama() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const send = useCallback(async (messages, settings, onChunk, onThoughtChunk, onDone, onError) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    const { serverUrl, model, temperature, maxTokens, keepAlive, systemPrompt } = settings;

    const ollamaMessages = [];
    if (systemPrompt && systemPrompt.trim()) {
      ollamaMessages.push({ role: 'system', content: systemPrompt.trim() });
    }
    ollamaMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

    try {
      const response = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature,
            num_predict: maxTokens,
          },
          keep_alive: keepAlive,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Ollama API error ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // State machine for parsing <think> tags
      // States: 'normal' | 'in_think'
      let parseState = 'normal';
      let pendingContent = '';

      const processChunk = (text) => {
        // We accumulate text and parse think tags
        pendingContent += text;

        while (pendingContent.length > 0) {
          if (parseState === 'normal') {
            const thinkStart = pendingContent.indexOf('<think>');
            if (thinkStart === -1) {
              // No think tag found — check if we might be at the start of a partial tag
              const partialMatch = partialTagMatch(pendingContent, '<think>');
              if (partialMatch > 0) {
                // Flush everything before the potential partial tag
                const toFlush = pendingContent.slice(0, pendingContent.length - partialMatch);
                if (toFlush) onChunk(toFlush);
                pendingContent = pendingContent.slice(pendingContent.length - partialMatch);
                break;
              } else {
                // Nothing pending — flush all
                onChunk(pendingContent);
                pendingContent = '';
                break;
              }
            } else {
              // Flush everything before <think>
              if (thinkStart > 0) {
                onChunk(pendingContent.slice(0, thinkStart));
              }
              pendingContent = pendingContent.slice(thinkStart + '<think>'.length);
              parseState = 'in_think';
            }
          } else if (parseState === 'in_think') {
            const thinkEnd = pendingContent.indexOf('</think>');
            if (thinkEnd === -1) {
              const partialMatch = partialTagMatch(pendingContent, '</think>');
              if (partialMatch > 0) {
                const toFlush = pendingContent.slice(0, pendingContent.length - partialMatch);
                if (toFlush) onThoughtChunk(toFlush);
                pendingContent = pendingContent.slice(pendingContent.length - partialMatch);
                break;
              } else {
                onThoughtChunk(pendingContent);
                pendingContent = '';
                break;
              }
            } else {
              if (thinkEnd > 0) {
                onThoughtChunk(pendingContent.slice(0, thinkEnd));
              }
              pendingContent = pendingContent.slice(thinkEnd + '</think>'.length);
              parseState = 'normal';
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (parsed.error) {
            throw new Error(parsed.error);
          }

          if (parsed.message?.content) {
            processChunk(parsed.message.content);
          }

          if (parsed.done) {
            // Flush any remaining pending content
            if (pendingContent) {
              if (parseState === 'in_think') {
                onThoughtChunk(pendingContent);
              } else {
                onChunk(pendingContent);
              }
              pendingContent = '';
            }
            break;
          }
        }
      }

      // Handle leftover buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.message?.content) {
            processChunk(parsed.message.content);
          }
        } catch {
          // ignore
        }
      }

      if (!controller.signal.aborted) {
        setIsStreaming(false);
        abortControllerRef.current = null;
        onDone();
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setIsStreaming(false);
        abortControllerRef.current = null;
        onDone();
        return;
      }
      setIsStreaming(false);
      abortControllerRef.current = null;
      onError(err);
    }
  }, []);

  return { isStreaming, send, stop };
}

/**
 * Returns how many characters at the end of `str` could be the beginning of `tag`.
 */
function partialTagMatch(str, tag) {
  for (let len = Math.min(tag.length - 1, str.length); len > 0; len--) {
    if (str.endsWith(tag.slice(0, len))) {
      return len;
    }
  }
  return 0;
}
