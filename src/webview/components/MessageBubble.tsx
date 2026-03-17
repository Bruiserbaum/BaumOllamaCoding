import React, { useState, useEffect } from 'react';
import { Message } from '../App';
import { renderMarkdown } from '../utils/markdown';

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  isThinking?: boolean;
}

export function MessageBubble({ message, isStreaming, isThinking }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasThought = !!message.thought;
  const [thoughtExpanded, setThoughtExpanded] = useState(false);

  // Auto-expand thought panel while thinking, collapse when done
  useEffect(() => {
    if (isThinking) {
      setThoughtExpanded(true);
    }
  }, [isThinking]);

  useEffect(() => {
    // When streaming ends and we had a thought, keep expanded for a moment then allow collapse
    if (!isStreaming && hasThought) {
      const timer = setTimeout(() => setThoughtExpanded(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, hasThought]);

  const markdownHtml = !isUser
    ? renderMarkdown(message.content + (isStreaming && !isThinking ? '<span class="streaming-cursor">▋</span>' : ''))
    : '';

  return (
    <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--assistant'}`}>
      {!isUser && (
        <div className="message-avatar">
          <span>◈</span>
        </div>
      )}

      <div className="message-body">
        {hasThought && (
          <div className={`thought-panel ${thoughtExpanded ? 'thought-panel--expanded' : ''}`}>
            <button
              className="thought-toggle"
              onClick={() => setThoughtExpanded((v) => !v)}
            >
              <span className="thought-icon">💭</span>
              <span className="thought-label">Thought Process</span>
              <span className="thought-chevron">{thoughtExpanded ? '▲' : '▼'}</span>
            </button>
            {thoughtExpanded && (
              <div className="thought-content">
                <em>{message.thought}</em>
              </div>
            )}
          </div>
        )}

        {isThinking && !hasThought && isStreaming && (
          <div className="thought-panel thought-panel--expanded">
            <div className="thought-toggle thought-toggle--static">
              <span className="thought-icon">💭</span>
              <span className="thought-label">Thinking...</span>
              <span className="streaming-cursor">▋</span>
            </div>
          </div>
        )}

        {isUser ? (
          <div className="message-content message-content--user">
            {message.content}
          </div>
        ) : (
          <div
            className="message-content message-content--assistant markdown-body"
            dangerouslySetInnerHTML={{ __html: markdownHtml }}
          />
        )}

        <div className="message-timestamp">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {isUser && (
        <div className="message-avatar message-avatar--user">
          <span>You</span>
        </div>
      )}
    </div>
  );
}
