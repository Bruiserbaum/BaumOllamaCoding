import React, { useRef, useState, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled: boolean;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || disabled || isStreaming) return;
    onSend(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div className="chat-input-container">
      {disabled && !isStreaming && (
        <div className="chat-input-hint">Select a model to start chatting</div>
      )}
      <div className={`chat-input-row ${disabled && !isStreaming ? 'chat-input-row--disabled' : ''}`}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'No model selected...' : 'Message BaumOllamaCoding... (Enter to send)'}
          disabled={disabled || isStreaming}
          rows={1}
        />
        {isStreaming ? (
          <button className="send-btn send-btn--stop" onClick={onStop} title="Stop generation">
            <span className="icon">■</span>
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            title="Send message"
          >
            <span className="icon">▶</span>
          </button>
        )}
      </div>
      <div className="chat-input-footer">
        <span className="chat-input-tip"><kbd>Enter</kbd> send &nbsp; <kbd>Shift+Enter</kbd> newline</span>
      </div>
    </div>
  );
}
