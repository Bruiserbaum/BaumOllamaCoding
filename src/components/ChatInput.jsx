import { useState, useRef, useEffect, useCallback } from 'react';

const CHAR_WARNING_THRESHOLD = 1000;

export default function ChatInput({ onSend, onStop, isStreaming, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  // Focus textarea after streaming ends
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (isStreaming) return;
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const isOverThreshold = text.length > CHAR_WARNING_THRESHOLD;

  return (
    <div className="chat-input-area">
      <div className={`chat-input-container ${isOverThreshold ? 'over-threshold' : ''}`}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Select a model to start chatting…'
              : isStreaming
              ? 'Waiting for response…'
              : 'Message Ollama… (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled || isStreaming}
          rows={1}
          aria-label="Chat message input"
        />

        <div className="input-actions">
          {isOverThreshold && (
            <span className={`char-count ${text.length > 4000 ? 'char-count-danger' : ''}`}>
              {text.length.toLocaleString()}
            </span>
          )}

          {isStreaming ? (
            <button
              className="action-btn stop-btn"
              onClick={onStop}
              title="Stop generation"
              aria-label="Stop generation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              className="action-btn send-btn"
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 13V3M3.5 7.5L8 3l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="input-footer">
        <span className="input-hint">
          {!isStreaming && !disabled && 'Enter to send · Shift+Enter for newline'}
          {disabled && 'Select a model from the dropdown above to start'}
        </span>
      </div>
    </div>
  );
}
