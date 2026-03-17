import { useState } from 'react';
import { PERFORMANCE_PRESETS } from '../utils/storage.js';

const KEEP_ALIVE_OPTIONS = [
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '2h', label: '2 hours' },
  { value: '-1', label: 'Never unload' },
];

export default function SettingsPanel({ settings, onSettingsChange, onClose, isOpen, onExport }) {
  const [connectionStatus, setConnectionStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [connectionMsg, setConnectionMsg] = useState('');

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMsg('');
    try {
      const res = await fetch(`${settings.serverUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const count = data.models?.length ?? 0;
        setConnectionStatus('ok');
        setConnectionMsg(`Connected! ${count} model${count !== 1 ? 's' : ''} found.`);
      } else {
        setConnectionStatus('error');
        setConnectionMsg(`Server returned ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionMsg(err.message || 'Could not connect to server.');
    }
  };

  const handlePerformanceMode = (mode) => {
    const preset = PERFORMANCE_PRESETS[mode];
    onSettingsChange({ performanceMode: mode, ...preset });
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`} role="dialog" aria-label="Settings">
      <div className="settings-header">
        <h2 className="settings-title">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginRight: 8, verticalAlign: 'middle' }}>
            <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 1.5V3M9 15v1.5M1.5 9H3M15 9h1.5M3.697 3.697l1.06 1.06M13.243 13.243l1.06 1.06M3.697 14.303l1.06-1.06M13.243 4.757l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Settings
        </h2>
        <button className="settings-close-btn" onClick={onClose} aria-label="Close settings">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="settings-body">
        {/* Server URL */}
        <section className="settings-section">
          <h3 className="settings-section-title">Server</h3>
          <label className="settings-label">Ollama Server URL</label>
          <div className="server-url-row">
            <input
              type="url"
              className="settings-input"
              value={settings.serverUrl}
              onChange={(e) => {
                onSettingsChange({ serverUrl: e.target.value });
                setConnectionStatus(null);
              }}
              placeholder="http://localhost:11434"
            />
            <button
              className={`test-connection-btn ${connectionStatus || ''}`}
              onClick={handleTestConnection}
              disabled={connectionStatus === 'testing'}
            >
              {connectionStatus === 'testing' ? 'Testing…' : 'Test'}
            </button>
          </div>
          {connectionMsg && (
            <p className={`connection-msg ${connectionStatus}`}>{connectionMsg}</p>
          )}
        </section>

        {/* Performance Mode */}
        <section className="settings-section">
          <h3 className="settings-section-title">Performance Mode</h3>
          <div className="performance-buttons">
            {(['fast', 'balanced', 'quality']).map((mode) => (
              <button
                key={mode}
                className={`perf-btn ${settings.performanceMode === mode ? 'active' : ''}`}
                onClick={() => handlePerformanceMode(mode)}
              >
                <span className="perf-icon">
                  {mode === 'fast' ? '⚡' : mode === 'balanced' ? '⚖' : '✦'}
                </span>
                <span className="perf-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                <span className="perf-desc">
                  {mode === 'fast' ? 'Quick responses' : mode === 'balanced' ? 'Best of both' : 'Higher quality'}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Temperature */}
        <section className="settings-section">
          <h3 className="settings-section-title">Generation Parameters</h3>

          <label className="settings-label">
            Temperature
            <span className="settings-value-badge">{settings.temperature.toFixed(2)}</span>
          </label>
          <input
            type="range"
            className="settings-slider"
            min="0"
            max="1"
            step="0.05"
            value={settings.temperature}
            onChange={(e) => onSettingsChange({ temperature: parseFloat(e.target.value), performanceMode: 'custom' })}
          />
          <div className="slider-labels">
            <span>Precise (0)</span>
            <span>Creative (1)</span>
          </div>

          <label className="settings-label" style={{ marginTop: '1rem' }}>
            Max Tokens
            <span className="settings-value-badge">{settings.maxTokens.toLocaleString()}</span>
          </label>
          <input
            type="range"
            className="settings-slider"
            min="256"
            max="8192"
            step="256"
            value={settings.maxTokens}
            onChange={(e) => onSettingsChange({ maxTokens: parseInt(e.target.value), performanceMode: 'custom' })}
          />
          <div className="slider-labels">
            <span>256</span>
            <span>8,192</span>
          </div>
        </section>

        {/* Keep Alive */}
        <section className="settings-section">
          <label className="settings-label">Keep Model Loaded</label>
          <div className="select-wrapper">
            <select
              className="settings-select"
              value={settings.keepAlive}
              onChange={(e) => onSettingsChange({ keepAlive: e.target.value })}
            >
              {KEEP_ALIVE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="select-arrow">▾</span>
          </div>
          <p className="settings-hint">How long to keep the model in memory after the last request.</p>
        </section>

        {/* System Prompt */}
        <section className="settings-section">
          <h3 className="settings-section-title">System Prompt</h3>
          <label className="settings-label">Instructions for the model</label>
          <textarea
            className="settings-textarea"
            value={settings.systemPrompt}
            onChange={(e) => onSettingsChange({ systemPrompt: e.target.value })}
            placeholder="You are a helpful coding assistant…"
            rows={5}
          />
          <p className="settings-hint">Applied at the start of every conversation.</p>
        </section>

        {/* Export */}
        <section className="settings-section">
          <h3 className="settings-section-title">Export Current Chat</h3>
          <div className="export-buttons">
            <button className="export-btn" onClick={() => onExport('json')}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export JSON
            </button>
            <button className="export-btn" onClick={() => onExport('markdown')}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export Markdown
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
