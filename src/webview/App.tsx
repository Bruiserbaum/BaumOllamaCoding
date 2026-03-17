import React, { useEffect, useRef, useState } from 'react';
import { vscode } from './vscode';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { SettingsPanel } from './components/SettingsPanel';
import { HistorySidebar } from './components/HistorySidebar';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  serverUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  keepAlive: string;
  systemPrompt: string;
}

export interface StreamingMessage {
  content: string;
  thought: string;
  isThinking: boolean;
}

const defaultSettings: Settings = {
  serverUrl: 'http://localhost:11434',
  defaultModel: '',
  temperature: 0.7,
  maxTokens: 2048,
  keepAlive: '30m',
  systemPrompt: '',
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function App() {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
  const messages = currentSession?.messages ?? [];

  // Request initial data on mount
  useEffect(() => {
    vscode.postMessage({ type: 'get-models' });
    vscode.postMessage({ type: 'get-sessions' });
    vscode.postMessage({ type: 'get-settings' });
  }, []);

  // Message listener
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as Record<string, unknown>;
      switch (msg.type) {
        case 'models': {
          const modelList = msg.models as string[];
          setModels(modelList);
          setModelsError(null);
          setSelectedModel((prev) => {
            if (prev && modelList.includes(prev)) return prev;
            if (settings.defaultModel && modelList.includes(settings.defaultModel)) return settings.defaultModel;
            return modelList[0] ?? '';
          });
          break;
        }
        case 'models-error': {
          setModelsError(msg.error as string);
          break;
        }
        case 'chunk': {
          setStreamingMessage((prev) => ({
            content: (prev?.content ?? '') + (msg.content as string),
            thought: prev?.thought ?? '',
            isThinking: false,
          }));
          break;
        }
        case 'thought-chunk': {
          setStreamingMessage((prev) => ({
            content: prev?.content ?? '',
            thought: (prev?.thought ?? '') + (msg.content as string),
            isThinking: true,
          }));
          break;
        }
        case 'done': {
          setStreamingMessage((prev) => {
            if (prev) {
              finalizeStreamingMessage(prev);
            }
            return null;
          });
          setIsStreaming(false);
          break;
        }
        case 'error': {
          setStreamingMessage(null);
          setIsStreaming(false);
          break;
        }
        case 'sessions': {
          setSessions(msg.sessions as Session[]);
          break;
        }
        case 'settings': {
          const s = msg.settings as Settings;
          setSettings(s);
          setSelectedModel((prev) => {
            if (prev) return prev;
            return s.defaultModel ?? '';
          });
          break;
        }
        case 'settings-saved': {
          setIsSettingsOpen(false);
          vscode.postMessage({ type: 'get-models' });
          break;
        }
        case 'new-chat': {
          startNewChat();
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, currentSessionId, settings]);

  const finalizeStreamingMessage = (streaming: StreamingMessage) => {
    const assistantMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: streaming.content,
      thought: streaming.thought || undefined,
      timestamp: Date.now(),
    };

    setSessions((prevSessions) => {
      let updatedSessions: Session[];

      if (!currentSessionId) {
        return prevSessions;
      }

      updatedSessions = prevSessions.map((s) => {
        if (s.id === currentSessionId) {
          const updated: Session = {
            ...s,
            messages: [...s.messages, assistantMsg],
            updatedAt: Date.now(),
          };
          // Save to extension host
          vscode.postMessage({ type: 'save-session', session: updated });
          return updated;
        }
        return s;
      });

      return updatedSessions;
    });
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setStreamingMessage(null);
    setIsStreaming(false);
  };

  const sendMessage = (text: string) => {
    if (!text.trim() || !selectedModel || isStreaming) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    let sessionId = currentSessionId;
    let updatedSessions = sessions;

    if (!sessionId) {
      // Create new session
      const newSession: Session = {
        id: generateId(),
        title: text.trim().slice(0, 50) || 'New Chat',
        messages: [userMsg],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessionId = newSession.id;
      updatedSessions = [newSession, ...sessions];
      setSessions(updatedSessions);
      setCurrentSessionId(sessionId);
      vscode.postMessage({ type: 'save-session', session: newSession });
    } else {
      updatedSessions = sessions.map((s) => {
        if (s.id === sessionId) {
          const updated: Session = {
            ...s,
            messages: [...s.messages, userMsg],
            updatedAt: Date.now(),
          };
          vscode.postMessage({ type: 'save-session', session: updated });
          return updated;
        }
        return s;
      });
      setSessions(updatedSessions);
    }

    const currentSess = updatedSessions.find((s) => s.id === sessionId);
    const ollamaMessages = (currentSess?.messages ?? []).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    setStreamingMessage({ content: '', thought: '', isThinking: false });
    setIsStreaming(true);

    vscode.postMessage({
      type: 'send',
      messages: ollamaMessages,
      model: selectedModel,
      settings: {
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        keepAlive: settings.keepAlive,
        systemPrompt: settings.systemPrompt,
      },
    });
  };

  const stopStreaming = () => {
    vscode.postMessage({ type: 'stop' });
  };

  const loadSession = (id: string) => {
    setCurrentSessionId(id);
    setStreamingMessage(null);
    setIsStreaming(false);
    setIsSidebarOpen(false);
  };

  const deleteSession = (id: string) => {
    vscode.postMessage({ type: 'delete-session', id });
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  };

  const exportChat = () => {
    if (!currentSession) return;
    const lines: string[] = [`# ${currentSession.title}\n`];
    for (const msg of currentSession.messages) {
      lines.push(`## ${msg.role === 'user' ? 'You' : 'Assistant'}\n`);
      if (msg.thought) {
        lines.push(`*Thought process:*\n> ${msg.thought.replace(/\n/g, '\n> ')}\n`);
      }
      lines.push(`${msg.content}\n`);
    }
    const content = lines.join('\n');
    const filename = `${currentSession.title.replace(/[^a-z0-9]/gi, '_')}.md`;
    vscode.postMessage({ type: 'export', content, filename });
  };

  return (
    <div className="app">
      {isSidebarOpen && (
        <HistorySidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={loadSession}
          onDeleteSession={deleteSession}
          onNewChat={startNewChat}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="main-content">
        <Header
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          onExport={exportChat}
          modelsError={modelsError}
        />
        <ChatWindow
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
        />
        <ChatInput
          onSend={sendMessage}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          disabled={!selectedModel}
        />
      </div>
      {isSettingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={(s) => {
            setSettings((prev) => ({ ...prev, ...s }));
            vscode.postMessage({ type: 'save-settings', settings: s });
          }}
          onClose={() => setIsSettingsOpen(false)}
          serverUrl={settings.serverUrl}
        />
      )}
    </div>
  );
}
