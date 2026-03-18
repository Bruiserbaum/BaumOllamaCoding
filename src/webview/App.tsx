import React, { useEffect, useRef, useState } from 'react';
import { vscode } from './vscode';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { SettingsPanel } from './components/SettingsPanel';
import { HistorySidebar } from './components/HistorySidebar';
import { Attachment } from './components/AttachmentList';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thought?: string;
  timestamp: number;
  attachments?: Attachment[];
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
  openHandsUrl: string;
}

export interface StreamingMessage {
  content: string;
  thought: string;
  isThinking: boolean;
}

export interface GitHubStatus {
  connected: boolean;
  user?: { login: string; name: string };
}

export interface WorkspaceContext {
  repoName: string | null;
  branch: string | null;
  remoteUrl: string | null;
  changedFiles: string[];
  stagedFiles: string[];
}

const defaultSettings: Settings = {
  serverUrl: 'http://localhost:11434',
  defaultModel: '',
  temperature: 0.7,
  maxTokens: 2048,
  keepAlive: '30m',
  systemPrompt: '',
  openHandsUrl: 'http://localhost:3002',
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

  // GitHub state
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false });

  // Pending attachments to inject into ChatInput (from file picker / github fetch)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? null;
  const messages = currentSession?.messages ?? [];

  // Keep a ref for finalizeStreamingMessage to always have fresh session state
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  // Request initial data on mount
  useEffect(() => {
    vscode.postMessage({ type: 'get-models' });
    vscode.postMessage({ type: 'get-sessions' });
    vscode.postMessage({ type: 'get-settings' });
    vscode.postMessage({ type: 'github-init' });
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
        // Feature 1: file picker result
        case 'files-selected': {
          const files = msg.files as Attachment[];
          if (files && files.length > 0) {
            setPendingAttachments((prev) => [...prev, ...files]);
          }
          break;
        }
        // Feature 2: GitHub status
        case 'github-status': {
          setGithubStatus({
            connected: msg.connected as boolean,
            user: msg.user as { login: string; name: string } | undefined,
          });
          break;
        }
        // Feature 2: GitHub content fetched (PR, issue, file)
        case 'github-content': {
          const content = msg.content as string;
          const label = msg.label as string;
          const att: Attachment = {
            id: generateId(),
            type: 'text',
            content,
            mimeType: 'text/plain',
            name: label,
          };
          setPendingAttachments((prev) => [...prev, att]);
          break;
        }
        // Feature 2: current file from editor
        case 'current-file': {
          const name = msg.name as string;
          const fileContent = msg.content as string;
          const language = msg.language as string;
          const att: Attachment = {
            id: generateId(),
            type: 'text',
            content: `\`\`\`${language}\n${fileContent}\n\`\`\``,
            mimeType: 'text/plain',
            name,
          };
          setPendingAttachments((prev) => [...prev, att]);
          break;
        }
        // Feature 2: workspace context
        case 'workspace-context': {
          const ctx = msg.context as WorkspaceContext;
          const lines: string[] = ['**Workspace Context:**'];
          if (ctx.repoName) lines.push(`- Repo: ${ctx.repoName}`);
          if (ctx.branch) lines.push(`- Branch: ${ctx.branch}`);
          if (ctx.remoteUrl) lines.push(`- Remote: ${ctx.remoteUrl}`);
          if (ctx.changedFiles.length > 0) {
            lines.push(`- Changed files:\n${ctx.changedFiles.map((f) => `  - ${f}`).join('\n')}`);
          }
          if (ctx.stagedFiles.length > 0) {
            lines.push(`- Staged files:\n${ctx.stagedFiles.map((f) => `  - ${f}`).join('\n')}`);
          }
          const att: Attachment = {
            id: generateId(),
            type: 'text',
            content: lines.join('\n'),
            mimeType: 'text/plain',
            name: 'workspace-context.md',
          };
          setPendingAttachments((prev) => [...prev, att]);
          break;
        }
        // Feature 2: github search results
        case 'github-search-results': {
          const items = msg.items as Array<{ path: string; repo: string; snippet: string }>;
          const lines = ['**GitHub Code Search Results:**', ''];
          for (const item of items) {
            lines.push(`**${item.repo}** — \`${item.path}\``);
            if (item.snippet) lines.push(`> ${item.snippet}`);
            lines.push('');
          }
          const att: Attachment = {
            id: generateId(),
            type: 'text',
            content: lines.join('\n'),
            mimeType: 'text/plain',
            name: 'github-search.md',
          };
          setPendingAttachments((prev) => [...prev, att]);
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
      const sid = currentSessionIdRef.current;
      if (!sid) return prevSessions;

      const updatedSessions = prevSessions.map((s) => {
        if (s.id === sid) {
          const updated: Session = {
            ...s,
            messages: [...s.messages, assistantMsg],
            updatedAt: Date.now(),
          };
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

  const sendMessage = (text: string, attachments: Attachment[]) => {
    const hasContent = text.trim() || attachments.length > 0;
    if (!hasContent || !selectedModel || isStreaming) return;

    // Build the user message content: prepend text attachments as code blocks
    let fullContent = text.trim();
    for (const att of attachments) {
      if (att.type === 'text' && att.content) {
        const ext = att.name.includes('.') ? att.name.split('.').pop() ?? '' : '';
        fullContent = `\`\`\`${ext}\n// ${att.name}\n${att.content}\n\`\`\`\n\n${fullContent}`;
      }
    }
    fullContent = fullContent.trim();

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: fullContent || '(attached files)',
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    let sessionId = currentSessionId;
    let updatedSessions = sessions;

    if (!sessionId) {
      const newSession: Session = {
        id: generateId(),
        title: (fullContent || attachments[0]?.name || 'New Chat').slice(0, 50),
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
      // Pass images from the last user message only (most recent)
      ...(m.id === userMsg.id && attachments.some((a) => a.type === 'image')
        ? { images: attachments.filter((a) => a.type === 'image' && a.base64).map((a) => a.base64 as string) }
        : {}),
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
          githubStatus={githubStatus}
          onAddCurrentFile={() => vscode.postMessage({ type: 'get-current-file' })}
          onAddWorkspaceContext={() => vscode.postMessage({ type: 'get-workspace-context' })}
          onOpenHands={() => vscode.postMessage({ type: 'open-openhands' })}
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
          selectedModel={selectedModel}
          pendingAttachments={pendingAttachments}
          onClearPendingAttachments={() => setPendingAttachments([])}
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
          githubStatus={githubStatus}
          onGithubConnect={(token) => vscode.postMessage({ type: 'github-connect', token })}
          onGithubDisconnect={() => vscode.postMessage({ type: 'github-disconnect' })}
          onGithubFetchUrl={(url) => {
            vscode.postMessage({ type: 'github-fetch-url', url });
            setIsSettingsOpen(false);
          }}
          onGithubSearch={(query, repo) => {
            vscode.postMessage({ type: 'github-search', query, repo });
            setIsSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
