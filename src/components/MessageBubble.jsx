import { useState, useEffect, useRef } from 'react';
import { renderMarkdown } from '../utils/markdown.js';

function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function MessageBubble({ message, isStreaming, isThinking }) {
  const { role, content, thought, timestamp } = message;
  const [thoughtExpanded, setThoughtExpanded] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const contentRef = useRef(null);

  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const hasThought = thought && thought.trim().length > 0;

  // Auto-expand thought while it's actively being thought
  useEffect(() => {
    if (isThinking && isStreaming) {
      setThoughtExpanded(true);
    }
  }, [isThinking, isStreaming]);

  // Collapse thought when streaming completes and thought is done
  useEffect(() => {
    if (!isStreaming && !isThinking) {
      // Keep expanded if user manually opened it; only auto-collapse if it was auto-opened
    }
  }, [isStreaming, isThinking]);

  const renderedContent = isAssistant ? renderMarkdown(content) : null;

  return (
    <div
      className={`message-bubble-wrapper ${isUser ? 'user' : 'assistant'}`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {isAssistant && (
        <div className="assistant-avatar">
          <span>◈</span>
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {/* Thought Process Section */}
        {isAssistant && (hasThought || isThinking) && (
          <div className={`thought-container ${thoughtExpanded ? 'expanded' : 'collapsed'}`}>
            <button
              className="thought-toggle"
              onClick={() => setThoughtExpanded((v) => !v)}
              aria-expanded={thoughtExpanded}
            >
              <span className="thought-toggle-icon">{thoughtExpanded ? '▼' : '▶'}</span>
              <span className="thought-toggle-label">Thought Process</span>
              {isThinking && isStreaming && (
                <span className="thinking-indicator">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </span>
              )}
            </button>
            {thoughtExpanded && (
              <div className="thought-content">
                <pre className="thought-text">{thought || ''}</pre>
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        {isUser ? (
          <div className="message-text user-text">{content}</div>
        ) : (
          <div className="message-content" ref={contentRef}>
            {content ? (
              <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            ) : isStreaming ? (
              <span className="streaming-cursor" aria-label="Thinking…">|</span>
            ) : null}
          </div>
        )}
      </div>

      {isUser && (
        <div className="user-avatar">
          <span>U</span>
        </div>
      )}

      {showTimestamp && timestamp && (
        <div className={`message-timestamp ${isUser ? 'timestamp-right' : 'timestamp-left'}`}>
          {formatTimestamp(timestamp)}
        </div>
      )}
    </div>
  );
}
