import { useState } from 'react';

export default function Header({ models, settings, onSettingsChange, onToggleSettings, onToggleSidebar, isStreaming }) {
  const [showWebSearchTooltip, setShowWebSearchTooltip] = useState(false);

  const displayModelName = (name) => {
    if (!name) return 'No model';
    // Show name without :latest tag for cleaner display
    return name.replace(/:latest$/, '');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="8" width="14" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="13" width="14" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        <div className="app-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">BaumOllamaCoding</span>
        </div>
      </div>

      <div className="header-center">
        <div className="model-selector-wrapper">
          <select
            className="model-selector"
            value={settings.model}
            onChange={(e) => onSettingsChange({ model: e.target.value })}
            disabled={isStreaming}
            title="Select model"
          >
            {models.length === 0 ? (
              <option value="">No models available</option>
            ) : (
              <>
                {!settings.model && <option value="">Select a model…</option>}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {displayModelName(m)}
                  </option>
                ))}
              </>
            )}
          </select>
          <span className="model-selector-arrow">▾</span>
        </div>
      </div>

      <div className="header-right">
        <div className="web-search-wrapper">
          <button
            className="header-btn web-search-btn"
            onMouseEnter={() => setShowWebSearchTooltip(true)}
            onMouseLeave={() => setShowWebSearchTooltip(false)}
            onClick={() => setShowWebSearchTooltip((v) => !v)}
            aria-label="Web Search (Coming Soon)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Web Search</span>
            <span className="coming-soon-badge">Soon</span>
          </button>
          {showWebSearchTooltip && (
            <div className="coming-soon-tooltip">
              Web search integration coming soon!
            </div>
          )}
        </div>

        <button
          className={`header-btn settings-btn ${isStreaming ? 'spinning' : ''}`}
          onClick={onToggleSettings}
          title="Settings"
          aria-label="Open settings"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M9 1.5V3M9 15v1.5M1.5 9H3M15 9h1.5M3.697 3.697l1.06 1.06M13.243 13.243l1.06 1.06M3.697 14.303l1.06-1.06M13.243 4.757l1.06-1.06"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
