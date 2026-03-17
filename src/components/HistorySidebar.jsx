import { useState } from 'react';

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export default function HistorySidebar({ sessions, currentSessionId, onSelect, onNew, onDelete, isOpen }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-cancel confirm after 3 seconds
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <aside className={`history-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNew}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="sessions-list">
        {sessions.length === 0 ? (
          <div className="sessions-empty">
            <p>No conversations yet.</p>
            <p>Start a new chat!</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => onSelect(session.id)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => {
                setHoveredId(null);
                if (confirmDeleteId === session.id) setConfirmDeleteId(null);
              }}
            >
              <div className="session-info">
                <span className="session-title">{session.title}</span>
                <span className="session-date">{formatDate(session.createdAt)}</span>
              </div>
              {(hoveredId === session.id || session.id === currentSessionId) && (
                <button
                  className={`delete-session-btn ${confirmDeleteId === session.id ? 'confirm' : ''}`}
                  onClick={(e) => handleDeleteClick(e, session.id)}
                  title={confirmDeleteId === session.id ? 'Click again to confirm' : 'Delete chat'}
                  aria-label="Delete chat"
                >
                  {confirmDeleteId === session.id ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M11 3.5l-.7 8.1a.5.5 0 01-.5.4H4.2a.5.5 0 01-.5-.4L3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-footer-text">
          {sessions.length} {sessions.length === 1 ? 'conversation' : 'conversations'}
        </span>
      </div>
    </aside>
  );
}
