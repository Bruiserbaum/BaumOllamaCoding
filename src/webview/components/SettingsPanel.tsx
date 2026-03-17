import React, { useState } from 'react';
import { Settings, GitHubStatus } from '../App';
import { vscode } from '../vscode';

interface SettingsPanelProps {
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  onClose: () => void;
  serverUrl: string;
  githubStatus: GitHubStatus;
  onGithubConnect: (token: string) => void;
  onGithubDisconnect: () => void;
  onGithubFetchUrl: (url: string) => void;
  onGithubSearch: (query: string, repo?: string) => void;
}

type Preset = 'fast' | 'balanced' | 'quality';

const PRESETS: Record<Preset, { temperature: number; maxTokens: number; label: string; description: string }> = {
  fast: { temperature: 0.3, maxTokens: 512, label: 'Fast', description: 'Lower quality, faster responses' },
  balanced: { temperature: 0.7, maxTokens: 2048, label: 'Balanced', description: 'Good quality and speed' },
  quality: { temperature: 0.9, maxTokens: 4096, label: 'Quality', description: 'Best quality, slower responses' },
};

const KEEP_ALIVE_OPTIONS = ['5m', '15m', '30m', '1h', '2h', '-1'];

export function SettingsPanel({
  settings,
  onSave,
  onClose,
  githubStatus,
  onGithubConnect,
  onGithubDisconnect,
  onGithubFetchUrl,
  onGithubSearch,
}: SettingsPanelProps) {
  const [local, setLocal] = useState<Settings>({ ...settings });
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // GitHub state
  const [githubToken, setGithubToken] = useState('');
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [githubFetchUrl, setGithubFetchUrl] = useState('');
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const [githubSearchRepo, setGithubSearchRepo] = useState('');

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: Preset) => {
    const p = PRESETS[preset];
    setLocal((prev) => ({ ...prev, temperature: p.temperature, maxTokens: p.maxTokens }));
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const res = await fetch(`${local.serverUrl.replace(/\/$/, '')}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleSave = () => {
    onSave(local);
  };

  const handleGithubConnect = () => {
    if (!githubToken.trim()) return;
    setGithubConnecting(true);
    onGithubConnect(githubToken.trim());
    setGithubToken('');
    // Reset connecting state after a short delay (actual state comes from message)
    setTimeout(() => setGithubConnecting(false), 3000);
  };

  const handleGithubFetch = () => {
    if (!githubFetchUrl.trim()) return;
    onGithubFetchUrl(githubFetchUrl.trim());
    setGithubFetchUrl('');
  };

  const handleGithubSearch = () => {
    if (!githubSearchQuery.trim()) return;
    onGithubSearch(githubSearchQuery.trim(), githubSearchRepo.trim() || undefined);
    setGithubSearchQuery('');
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <span className="icon">✕</span>
          </button>
        </div>

        <div className="settings-body">
          {/* Server URL */}
          <div className="settings-section">
            <label className="settings-label">Ollama Server URL</label>
            <div className="settings-row">
              <input
                type="text"
                className="settings-input"
                value={local.serverUrl}
                onChange={(e) => update('serverUrl', e.target.value)}
                placeholder="http://localhost:11434"
              />
              <button
                className={`btn-small ${testStatus === 'ok' ? 'btn-small--success' : testStatus === 'error' ? 'btn-small--error' : ''}`}
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? '...' : testStatus === 'ok' ? '✓ OK' : testStatus === 'error' ? '✗ Fail' : 'Test'}
              </button>
            </div>
            {testStatus === 'error' && testError && (
              <div className="settings-error">{testError}</div>
            )}
          </div>

          {/* Default Model */}
          <div className="settings-section">
            <label className="settings-label">Default Model</label>
            <input
              type="text"
              className="settings-input"
              value={local.defaultModel}
              onChange={(e) => update('defaultModel', e.target.value)}
              placeholder="e.g. llama3.2, qwq:32b"
            />
          </div>

          {/* Presets */}
          <div className="settings-section">
            <label className="settings-label">Performance Preset</label>
            <div className="presets-row">
              {(Object.entries(PRESETS) as [Preset, typeof PRESETS[Preset]][]).map(([key, preset]) => (
                <button
                  key={key}
                  className={`preset-btn ${
                    local.temperature === preset.temperature && local.maxTokens === preset.maxTokens
                      ? 'preset-btn--active'
                      : ''
                  }`}
                  onClick={() => applyPreset(key)}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div className="settings-section">
            <label className="settings-label">
              Temperature: <span className="settings-value">{local.temperature.toFixed(2)}</span>
            </label>
            <input
              type="range"
              className="settings-slider"
              min={0}
              max={1}
              step={0.05}
              value={local.temperature}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
            />
            <div className="settings-slider-labels">
              <span>Precise (0)</span>
              <span>Creative (1)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="settings-section">
            <label className="settings-label">
              Max Tokens: <span className="settings-value">{local.maxTokens}</span>
            </label>
            <input
              type="range"
              className="settings-slider"
              min={256}
              max={8192}
              step={256}
              value={local.maxTokens}
              onChange={(e) => update('maxTokens', parseInt(e.target.value, 10))}
            />
            <div className="settings-slider-labels">
              <span>256</span>
              <span>8192</span>
            </div>
          </div>

          {/* Keep Alive */}
          <div className="settings-section">
            <label className="settings-label">Keep Alive</label>
            <select
              className="settings-select"
              value={local.keepAlive}
              onChange={(e) => update('keepAlive', e.target.value)}
            >
              {KEEP_ALIVE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === '-1' ? 'Forever' : opt}
                </option>
              ))}
            </select>
          </div>

          {/* System Prompt */}
          <div className="settings-section">
            <label className="settings-label">System Prompt</label>
            <textarea
              className="settings-textarea"
              value={local.systemPrompt}
              onChange={(e) => update('systemPrompt', e.target.value)}
              placeholder="Optional system prompt to guide model behavior..."
              rows={4}
            />
          </div>

          {/* ===== GitHub Section ===== */}
          <div className="settings-section settings-section--github">
            <label className="settings-label settings-label--section">GitHub Integration</label>

            {githubStatus.connected ? (
              <div className="github-connected">
                <span className="github-connected-info">
                  Connected as <strong>{githubStatus.user?.login ?? 'unknown'}</strong>
                  {githubStatus.user?.name ? ` (${githubStatus.user.name})` : ''}
                </span>
                <button
                  className="btn-small btn-small--error"
                  onClick={onGithubDisconnect}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="github-connect-form">
                <div className="settings-row">
                  <input
                    type="password"
                    className="settings-input"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="GitHub Personal Access Token"
                    onKeyDown={(e) => e.key === 'Enter' && handleGithubConnect()}
                  />
                  <button
                    className="btn-small"
                    onClick={handleGithubConnect}
                    disabled={!githubToken.trim() || githubConnecting}
                  >
                    {githubConnecting ? '...' : 'Connect'}
                  </button>
                </div>
                <div className="settings-hint">
                  Token needs <code>repo</code> scope. Stored securely in VS Code secrets.
                </div>
              </div>
            )}

            {githubStatus.connected && (
              <>
                {/* Fetch URL */}
                <div className="github-subsection">
                  <label className="settings-sublabel">Fetch GitHub URL</label>
                  <div className="settings-row">
                    <input
                      type="text"
                      className="settings-input"
                      value={githubFetchUrl}
                      onChange={(e) => setGithubFetchUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo/blob/main/file.ts"
                      onKeyDown={(e) => e.key === 'Enter' && handleGithubFetch()}
                    />
                    <button
                      className="btn-small"
                      onClick={handleGithubFetch}
                      disabled={!githubFetchUrl.trim()}
                    >
                      Fetch
                    </button>
                  </div>
                </div>

                {/* Search Code */}
                <div className="github-subsection">
                  <label className="settings-sublabel">Search Code</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={githubSearchQuery}
                    onChange={(e) => setGithubSearchQuery(e.target.value)}
                    placeholder="Search query..."
                    style={{ marginBottom: 4 }}
                  />
                  <div className="settings-row">
                    <input
                      type="text"
                      className="settings-input"
                      value={githubSearchRepo}
                      onChange={(e) => setGithubSearchRepo(e.target.value)}
                      placeholder="owner/repo (optional)"
                      onKeyDown={(e) => e.key === 'Enter' && handleGithubSearch()}
                    />
                    <button
                      className="btn-small"
                      onClick={handleGithubSearch}
                      disabled={!githubSearchQuery.trim()}
                    >
                      Search
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
