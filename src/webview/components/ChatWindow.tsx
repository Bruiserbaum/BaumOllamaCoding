import React, { useEffect, useRef } from 'react';
import { Message, StreamingMessage } from '../App';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  messages: Message[];
  streamingMessage: StreamingMessage | null;
  isStreaming: boolean;
}

export function ChatWindow({ messages, streamingMessage, isStreaming }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div className="chat-window chat-window--empty">
        <div className="empty-state">
          <div className="empty-icon">◈</div>
          <h3 className="empty-title">Start a conversation</h3>
          <p className="empty-subtitle">
            Select a model and type a message below
          </p>
          <div className="empty-hint">
            <kbd>Enter</kbd> to send &nbsp;·&nbsp; <kbd>Shift+Enter</kbd> for newline
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="messages-list">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isStreaming={false} />
        ))}

        {streamingMessage !== null && (
          <MessageBubble
            message={{
              id: '__streaming__',
              role: 'assistant',
              content: streamingMessage.content,
              thought: streamingMessage.thought || undefined,
              timestamp: Date.now(),
            }}
            isStreaming={isStreaming}
            isThinking={streamingMessage.isThinking}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
