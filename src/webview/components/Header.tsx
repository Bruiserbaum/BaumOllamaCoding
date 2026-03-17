import React from 'react';
import { vscode } from '../vscode';

interface HeaderProps {
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  onExport: () => void;
  modelsError: string | null;
}

export function Header({
  models,
  selectedModel,
  onModelChange,
  onOpenSettings,
  onToggleSidebar,
  onExport,
  modelsError,
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

        <div className="web-search-row">
          <button className="web-search-btn" disabled title="Coming soon">
            <span className="icon">🔍</span>
            Web Search
            <span className="badge">Coming Soon</span>
          </button>
        </div>
      </div>
    </header>
  );
}
