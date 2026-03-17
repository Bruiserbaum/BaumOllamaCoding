const SESSIONS_KEY = 'baumollama_sessions';
const SETTINGS_KEY = 'baumollama_settings';

export const PERFORMANCE_PRESETS = {
  fast: {
    temperature: 0.1,
    maxTokens: 512,
    keepAlive: '5m',
  },
  balanced: {
    temperature: 0.7,
    maxTokens: 2048,
    keepAlive: '30m',
  },
  quality: {
    temperature: 0.8,
    maxTokens: 4096,
    keepAlive: '60m',
  },
};

export const DEFAULT_SETTINGS = {
  serverUrl: 'http://localhost:11434',
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
  keepAlive: '30m',
  performanceMode: 'balanced',
  systemPrompt: '',
};

export function generateId() {
  return crypto.randomUUID();
}

export function getSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
  }
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function createSession(firstMessage = null) {
  const id = generateId();
  const title = firstMessage
    ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
    : 'New Chat';
  return {
    id,
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  };
}

export function autoTitle(text) {
  if (!text) return 'New Chat';
  const clean = text.trim().replace(/\n+/g, ' ');
  return clean.slice(0, 60) + (clean.length > 60 ? '…' : '');
}
