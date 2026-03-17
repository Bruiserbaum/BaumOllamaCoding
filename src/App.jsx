import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ChatInput from './components/ChatInput.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import HistorySidebar from './components/HistorySidebar.jsx';
import { useOllama } from './hooks/useOllama.js';
import {
  getSessions,
  saveSessions,
  getSettings,
  saveSettings,
  generateId,
  createSession,
  autoTitle,
} from './utils/storage.js';

export default function App() {
  const [sessions, setSessions] = useState(() => getSessions());
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    const saved = getSessions();
    return saved.length > 0 ? saved[0].id : null;
  });
  const [settings, setSettings] = useState(() => getSettings());
  const [models, setModels] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState({
    content: '',
    thought: '',
    isThinking: false,
  });
  const [error, setError] = useState(null);

  const { isStreaming, send, stop } = useOllama();
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Fetch models on mount and when server URL changes
  useEffect(() => {
    fetchModels(settings.serverUrl);
  }, [settings.serverUrl]);

  const fetchModels = async (serverUrl) => {
    try {
      const res = await fetch(`${serverUrl}/api/tags`);
      if (!res.ok) return;
      const data = await res.json();
      const modelList = (data.models || []).map((m) => m.name);
      setModels(modelList);
      // Auto-select first model if none selected
      setSettings((prev) => {
        if (!prev.model && modelList.length > 0) {
          const updated = { ...prev, model: modelList[0] };
          saveSettings(updated);
          return updated;
        }
        return prev;
      });
    } catch {
      setModels([]);
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;
  const currentMessages = currentSession?.messages || [];

  const handleSettingsChange = useCallback((updates) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const handleNewChat = useCallback(() => {
    const session = createSession();
    setSessions((prev) => {
      const updated = [session, ...prev];
      saveSessions(updated);
      return updated;
    });
    setCurrentSessionId(session.id);
    setStreamingMessage({ content: '', thought: '', isThinking: false });
    setError(null);
  }, []);

  const handleSelectSession = useCallback((id) => {
    setCurrentSessionId(id);
    setStreamingMessage({ content: '', thought: '', isThinking: false });
    setError(null);
  }, []);

  const handleDeleteSession = useCallback((id) => {
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    setCurrentSessionId((prev) => {
      if (prev === id) {
        const remaining = sessionsRef.current.filter((s) => s.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }, []);

  const handleSend = useCallback(
    (text) => {
      if (!text.trim() || isStreaming || !settings.model) return;
      setError(null);

      // Ensure we have a current session
      let sessionId = currentSessionId;
      let isNewSession = false;

      setSessions((prev) => {
        const existing = prev.find((s) => s.id === sessionId);
        if (!existing) {
          isNewSession = true;
          const newSession = createSession(text);
          const updated = [newSession, ...prev];
          saveSessions(updated);
          sessionId = newSession.id;
          setCurrentSessionId(newSession.id);
          return updated;
        }
        return prev;
      });

      const userMessage = {
        id: generateId(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      // Add user message and potentially set title
      setSessions((prev) => {
        return prev.map((s) => {
          const targetId = isNewSession ? sessionId : currentSessionId;
          if (s.id !== targetId) return s;
          const updatedMessages = [...s.messages, userMessage];
          // Set title from first user message if still default
          const title =
            s.messages.filter((m) => m.role === 'user').length === 0
              ? autoTitle(text)
              : s.title;
          const updated = { ...s, messages: updatedMessages, title };
          saveSessions(prev.map((ss) => (ss.id === s.id ? updated : ss)));
          return updated;
        });
      });

      // Reset streaming state
      setStreamingMessage({ content: '', thought: '', isThinking: false });

      // Build message history for API (exclude streaming artifacts)
      const historyMessages = [
        ...(sessionsRef.current.find((s) => s.id === (isNewSession ? sessionId : currentSessionId))
          ?.messages || []),
        userMessage,
      ].filter((m) => m.role === 'user' || m.role === 'assistant');

      let accContent = '';
      let accThought = '';

      send(
        historyMessages,
        settings,
        // onChunk
        (chunk) => {
          accContent += chunk;
          setStreamingMessage((prev) => ({ ...prev, content: accContent, isThinking: false }));
        },
        // onThoughtChunk
        (chunk) => {
          accThought += chunk;
          setStreamingMessage((prev) => ({ ...prev, thought: accThought, isThinking: true }));
        },
        // onDone
        () => {
          const assistantMessage = {
            id: generateId(),
            role: 'assistant',
            content: accContent,
            thought: accThought || null,
            timestamp: new Date().toISOString(),
          };

          const targetId = isNewSession ? sessionId : currentSessionId;
          setSessions((prev) => {
            const updated = prev.map((s) => {
              if (s.id !== targetId) return s;
              return { ...s, messages: [...s.messages, assistantMessage] };
            });
            saveSessions(updated);
            return updated;
          });

          setStreamingMessage({ content: '', thought: '', isThinking: false });
        },
        // onError
        (err) => {
          setError(err.message || 'An error occurred');
          setStreamingMessage({ content: '', thought: '', isThinking: false });
        }
      );
    },
    [currentSessionId, isStreaming, settings, send]
  );

  const handleExport = useCallback(
    (format) => {
      if (!currentSession) return;

      const filename = `${currentSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${
        new Date().toISOString().split('T')[0]
      }`;

      if (format === 'json') {
        const data = JSON.stringify(currentSession, null, 2);
        downloadFile(`${filename}.json`, data, 'application/json');
      } else if (format === 'markdown') {
        const lines = [`# ${currentSession.title}`, ``, `*Exported: ${new Date().toLocaleString()}*`, ``];
        for (const msg of currentSession.messages) {
          if (msg.role === 'user') {
            lines.push(`## You`, ``, msg.content, ``);
          } else if (msg.role === 'assistant') {
            lines.push(`## Assistant`, ``);
            if (msg.thought) {
              lines.push(`<details>`, `<summary>Thought Process</summary>`, ``, msg.thought, ``, `</details>`, ``);
            }
            lines.push(msg.content, ``);
          }
        }
        downloadFile(`${filename}.md`, lines.join('\n'), 'text/markdown');
      }
    },
    [currentSession]
  );

  return (
    <div className="app-layout">
      <Header
        models={models}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onToggleSettings={() => setIsSettingsOpen((v) => !v)}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        isStreaming={isStreaming}
      />
      <div className="app-body">
        <HistorySidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelect={handleSelectSession}
          onNew={handleNewChat}
          onDelete={handleDeleteSession}
          isOpen={isSidebarOpen}
        />
        <main className="main-area">
          {error && (
            <div className="error-banner">
              <span>⚠ {error}</span>
              <button onClick={() => setError(null)} className="error-dismiss">✕</button>
            </div>
          )}
          <ChatWindow
            messages={currentMessages}
            streamingMessage={isStreaming || streamingMessage.content || streamingMessage.thought ? streamingMessage : null}
            isStreaming={isStreaming}
          />
          <ChatInput
            onSend={handleSend}
            onStop={stop}
            isStreaming={isStreaming}
            disabled={!settings.model}
          />
        </main>
      </div>
      <SettingsPanel
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onClose={() => setIsSettingsOpen(false)}
        isOpen={isSettingsOpen}
        onExport={handleExport}
      />
      {isSettingsOpen && (
        <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
