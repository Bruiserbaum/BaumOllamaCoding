import React, { useState } from 'react';
import { Session } from '../App';

interface HistorySidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export function HistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onClose,
}: HistorySidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDeleteSession(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const formatDate = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3 className="sidebar-title">Chat History</h3>
        <button className="icon-btn" onClick={onClose} title="Close sidebar">
          <span className="icon">✕</span>
        </button>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <span className="icon">+</span>
        New Chat
      </button>

      <div className="sidebar-list">
        {sessions.length === 0 ? (
          <div className="sidebar-empty">No chat history yet</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`sidebar-item ${session.id === currentSessionId ? 'sidebar-item--active' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="sidebar-item-content">
                <div className="sidebar-item-title">{session.title}</div>
                <div className="sidebar-item-meta">
                  <span className="sidebar-item-date">{formatDate(session.updatedAt)}</span>
                  <span className="sidebar-item-count">
                    {session.messages.length} msg{session.messages.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button
                className={`sidebar-delete-btn ${confirmDeleteId === session.id ? 'sidebar-delete-btn--confirm' : ''}`}
                onClick={(e) => handleDelete(e, session.id)}
                title={confirmDeleteId === session.id ? 'Click again to confirm delete' : 'Delete chat'}
              >
                {confirmDeleteId === session.id ? '✓' : '✕'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
