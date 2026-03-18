import React from 'react';
import { vscode } from '../vscode';
import { GitHubStatus } from '../App';

interface HeaderProps {
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onExport: () => void;
  modelsError: string | null;
  githubStatus: GitHubStatus;
  onAddCurrentFile: () => void;
  onAddWorkspaceContext: () => void;
  onOpenHands: () => void;
}

export function Header({
  models,
  selectedModel,
  onModelChange,
  onOpenSettings,
  onToggleSidebar,
  onExport,
  modelsError,
  githubStatus,
  onAddCurrentFile,
  onAddWorkspaceContext,
  onOpenHands,
}: HeaderProps) {
  const handleRefreshModels = () => {
    vscode.postMessage({ type: 'get-models' });
  };

  const handleOpenPanel = () => {
    vscode.postMessage({ type: 'open-panel' });
  };

  return (
    <header className="header">
      <div className="header-top">
        <button className="header-sidebar-btn icon-btn" onClick={onToggleSidebar} title="Chat History">
          <span className="icon">☰</span>
        </button>
        <div className="header-title">
          <span className="header-icon">◈</span>
          <span className="header-name">BaumOllamaCoding</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={onExport}
            title="Export Chat"
          >
            <span className="icon">↓</span>
          </button>
          <button
            className="icon-btn"
            onClick={handleOpenPanel}
            title="Open in Panel"
          >
            <span className="icon">⊞</span>
          </button>
          <button
            className="icon-btn"
            onClick={onOpenHands}
            title="Open OpenHands Agent"
          >
            <span className="icon">🤖</span>
          </button>
          <button
            className="icon-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            <span className="icon">⚙</span>
          </button>
        </div>
      </div>

      <div className="header-bottom">
        <div className="model-row">
          {modelsError ? (
            <div className="model-error">
              <span className="model-error-text">⚠ {modelsError}</span>
              <button className="btn-small" onClick={handleRefreshModels}>
                Retry
              </button>
            </div>
          ) : models.length === 0 ? (
            <div className="model-error">
              <span className="model-error-text">No models found</span>
              <button className="btn-small" onClick={handleRefreshModels}>
                Refresh
              </button>
            </div>
          ) : (
            <>
              <select
                className="model-select"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button className="icon-btn" onClick={handleRefreshModels} title="Refresh Models">
                <span className="icon refresh-icon">↻</span>
              </button>
            </>
          )}
        </div>

        <div className="context-toolbar">
          <button
            className="context-btn"
            onClick={onAddCurrentFile}
            title="Add current editor file as context"
          >
            <span className="icon">📄</span>
            <span>Current File</span>
          </button>
          <button
            className="context-btn"
            onClick={onAddWorkspaceContext}
            title="Add workspace git context (branch, changed files)"
          >
            <span className="icon">🔀</span>
            <span>Git Context</span>
          </button>
          {githubStatus.connected && (
            <span
              className="github-connected-badge"
              title={`GitHub: ${githubStatus.user?.login ?? 'connected'}`}
            >
              <span className="icon">🐙</span>
              <span>{githubStatus.user?.login ?? 'GitHub'}</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
