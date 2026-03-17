import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';

export default function ChatWindow({ messages, streamingMessage, isStreaming }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);

  // Track scroll position to know if user has scrolled up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingMessage]);

  // Always scroll to bottom on new message from user
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      isNearBottomRef.current = true;
    }
  }, [messages.length]);

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div className="chat-window empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon">◈</div>
          <h2 className="empty-state-title">BaumOllamaCoding</h2>
          <p className="empty-state-subtitle">Start a conversation with your local Ollama models.</p>
          <div className="empty-state-hints">
            <div className="hint-item">
              <span className="hint-icon">⚡</span>
              <span>Streaming responses with thought process visualization</span>
            </div>
            <div className="hint-item">
              <span className="hint-icon">💬</span>
              <span>Multi-session chat history saved locally</span>
            </div>
            <div className="hint-item">
              <span className="hint-icon">🎨</span>
              <span>Markdown rendering with syntax highlighting</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window" ref={containerRef} onScroll={handleScroll}>
      <div className="messages-container">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isStreaming={false} />
        ))}
        {streamingMessage && (isStreaming || streamingMessage.content || streamingMessage.thought) && (
          <MessageBubble
            key="streaming"
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamingMessage.content,
              thought: streamingMessage.thought || null,
              timestamp: new Date().toISOString(),
            }}
            isStreaming={isStreaming}
            isThinking={streamingMessage.isThinking}
          />
        )}
        <div ref={bottomRef} className="scroll-anchor" />
      </div>
    </div>
  );
}
